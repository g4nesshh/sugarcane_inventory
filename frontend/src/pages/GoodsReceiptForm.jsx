import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { createGoodsReceipt } from '../api/goodsReceipts';
import { getPurchaseOrder, listPurchaseOrders } from '../api/purchaseOrders';
import { listWarehouses } from '../api/warehouses';
import { errorMessage } from '../api/client';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import FormField, { inputClass } from '../components/ui/FormField';
import LineItemsTable from '../components/ui/LineItemsTable';
import { LoadingState, ErrorState } from '../components/ui/States';

function outstandingLines(po) {
  return po.items
    .filter((l) => Number(l.orderedQuantity) > Number(l.receivedQuantity))
    .map((l) => ({
      itemId: l.item.id,
      itemLabel: `${l.item.itemCode} — ${l.item.name}`,
      remainingLabel: `${Number(l.orderedQuantity) - Number(l.receivedQuantity)} ${l.item.unit}`,
      unit: l.item.unit,
      quantity: '',
      batchNumber: '',
      expiryDate: '',
    }));
}

export default function GoodsReceiptForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPoId = searchParams.get('poId');

  // A stable key for this submission attempt — survives retries of the same
  // form session without crediting stock twice (the backend's idempotencyKey).
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [po, setPo] = useState(null);
  const [receivablePOs, setReceivablePOs] = useState(null);
  const [poError, setPoError] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listWarehouses({ status: 'ACTIVE', limit: 100 }).then((d) => setWarehouses(d.warehouses)).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialPoId) {
      getPurchaseOrder(initialPoId)
        .then((p) => { setPo(p); setLines(outstandingLines(p)); })
        .catch((err) => setPoError(errorMessage(err)));
    } else {
      Promise.all([
        listPurchaseOrders({ status: 'APPROVED', limit: 100 }),
        listPurchaseOrders({ status: 'PARTIALLY_RECEIVED', limit: 100 }),
      ])
        .then(([a, b]) => setReceivablePOs([...a.purchaseOrders, ...b.purchaseOrders]))
        .catch((err) => setPoError(errorMessage(err)));
    }
  }, [initialPoId]);

  const selectPo = (id) => {
    getPurchaseOrder(id)
      .then((p) => { setPo(p); setLines(outstandingLines(p)); })
      .catch((err) => toast.error(errorMessage(err)));
  };

  const updateLine = (idx, key, value) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const validLines = useMemo(() => lines.filter((l) => l.quantity && Number(l.quantity) > 0), [lines]);

  const submit = async (e) => {
    e.preventDefault();
    if (!warehouseId) return toast.error('Select a warehouse to receive into');
    if (validLines.length === 0) return toast.error('Enter a quantity for at least one line');

    setBusy(true);
    try {
      const receipt = await createGoodsReceipt({
        purchaseOrderId: po.id,
        warehouseId: Number(warehouseId),
        idempotencyKey,
        items: validLines.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
          batchNumber: l.batchNumber || undefined,
          expiryDate: l.expiryDate || undefined,
        })),
      });
      toast.success(`${receipt.receiptNumber} recorded`);
      navigate('/receipts');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (poError) return <ErrorState message={poError} />;

  return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => navigate('/receipts')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Back to goods receipts
      </button>

      <h1 className="font-display text-xl font-semibold text-ink-900">Receive goods</h1>

      {!po ? (
        receivablePOs === null ? (
          <LoadingState label="Loading purchase orders…" />
        ) : (
          <Panel title="Select a purchase order">
            {receivablePOs.length === 0 ? (
              <p className="text-sm text-ink-500">No purchase orders are currently approved or awaiting receipt.</p>
            ) : (
              <select className={inputClass} defaultValue="" onChange={(e) => selectPo(e.target.value)}>
                <option value="" disabled>Select a purchase order</option>
                {receivablePOs.map((p) => (
                  <option key={p.id} value={p.id}>{p.poNumber} — {p.supplier.name}</option>
                ))}
              </select>
            )}
          </Panel>
        )
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Panel title="Details">
            <dl className="grid grid-cols-2 gap-y-2 text-sm mb-4">
              <dt className="text-ink-500">Purchase order</dt>
              <dd className="text-ink-900">{po.poNumber}</dd>
              <dt className="text-ink-500">Supplier</dt>
              <dd className="text-ink-900">{po.supplier.name}</dd>
            </dl>
            <FormField label="Receiving warehouse" required>
              <select className={inputClass} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                <option value="" disabled>Select a warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </FormField>
          </Panel>

          <Panel title="Line items">
            {lines.length === 0 ? (
              <p className="text-sm text-ink-500">This purchase order has nothing left to receive.</p>
            ) : (
              <>
                <p className="text-xs text-ink-500 mb-3">
                  Leave a line's quantity blank to skip it (useful for a partial delivery). The remaining column shows what's still outstanding.
                </p>
                <LineItemsTable
                  columns={[
                    { key: 'itemLabel', header: 'Item', type: 'readonly', width: '28%' },
                    { key: 'remainingLabel', header: 'Remaining', type: 'readonly', width: '16%' },
                    { key: 'quantity', header: 'Receiving now', type: 'number', width: '16%' },
                    { key: 'batchNumber', header: 'Batch #', type: 'text', width: '18%' },
                    { key: 'expiryDate', header: 'Expiry date', type: 'date', width: '18%' },
                  ]}
                  rows={lines}
                  onRowChange={updateLine}
                  onRemoveRow={removeLine}
                />
              </>
            )}
          </Panel>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/receipts')} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || lines.length === 0}>
              {busy ? 'Recording…' : 'Record receipt'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
