import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { createStockTransfer } from '../api/stockTransfers';
import { listItems } from '../api/items';
import { listWarehouses } from '../api/warehouses';
import { errorMessage } from '../api/client';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import FormField, { inputClass } from '../components/ui/FormField';
import LineItemsTable from '../components/ui/LineItemsTable';
import { LoadingState } from '../components/ui/States';

const emptyLine = () => ({ itemId: '', quantity: '' });

export default function StockTransferForm() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [warehouses, setWarehouses] = useState(null);

  useEffect(() => {
    Promise.all([listItems({ status: 'ACTIVE', limit: 200 }), listWarehouses({ status: 'ACTIVE', limit: 100 })]).then(
      ([i, w]) => {
        setItems(i.items);
        setWarehouses(w.warehouses);
      }
    );
  }, []);

  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [busy, setBusy] = useState(false);

  if (!items || !warehouses) return <LoadingState label="Loading…" />;

  const updateLine = (idx, key, value) =>
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, [key]: value } : line)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const validLines = lines.filter((l) => l.itemId && l.quantity);

  const submit = async (e) => {
    e.preventDefault();
    if (!sourceWarehouseId || !destinationWarehouseId) return toast.error('Select both a source and destination warehouse');
    if (sourceWarehouseId === destinationWarehouseId) return toast.error('Source and destination warehouses must be different');
    if (validLines.length === 0) return toast.error('Add at least one line item');

    setBusy(true);
    try {
      const transfer = await createStockTransfer({
        sourceWarehouseId: Number(sourceWarehouseId),
        destinationWarehouseId: Number(destinationWarehouseId),
        items: validLines.map((l) => ({ itemId: Number(l.itemId), quantity: Number(l.quantity) })),
      });
      toast.success(`${transfer.transferNumber} created, pending approval`);
      navigate(`/transfers/${transfer.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => navigate('/transfers')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Back to stock transfers
      </button>

      <h1 className="font-display text-xl font-semibold text-ink-900">New stock transfer</h1>

      <form onSubmit={submit} className="space-y-5">
        <Panel title="Details">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Source warehouse" required>
              <select className={inputClass} value={sourceWarehouseId} onChange={(e) => setSourceWarehouseId(e.target.value)} required>
                <option value="" disabled>Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Destination warehouse" required>
              <select className={inputClass} value={destinationWarehouseId} onChange={(e) => setDestinationWarehouseId(e.target.value)} required>
                <option value="" disabled>Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </FormField>
          </div>
        </Panel>

        <Panel title="Line items">
          <LineItemsTable
            columns={[
              {
                key: 'itemId', header: 'Item', type: 'select', width: '60%', placeholder: 'Select item',
                options: items.map((i) => ({ value: i.id, label: `${i.itemCode} — ${i.name}` })),
              },
              { key: 'quantity', header: 'Quantity', type: 'number', width: '25%' },
            ]}
            rows={lines}
            onRowChange={updateLine}
            onAddRow={addLine}
            onRemoveRow={removeLine}
            addLabel="Add line item"
          />
          <p className="text-xs text-ink-500 mt-3">
            Stock moves only on approval — the source decrease and destination increase happen together, atomically. If any
            line can't be covered by the source warehouse's stock, the whole transfer is rejected, not just that line.
          </p>
        </Panel>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/transfers')} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </div>
      </form>
    </div>
  );
}
