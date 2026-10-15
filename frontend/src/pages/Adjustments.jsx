import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { listAdjustments, createAdjustment } from '../api/adjustments';
import { listItems } from '../api/items';
import { listWarehouses } from '../api/warehouses';
import { getItemInventory } from '../api/inventory';
import { useListPage } from '../hooks/useListPage';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { ADJUSTMENT_REASON_OPTIONS } from '../config/options';
import { errorMessage } from '../api/client';
import { formatDate, formatNumber, toSentenceCase } from '../utils/format';
import DataTable from '../components/ui/DataTable';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField, { inputClass } from '../components/ui/FormField';
import StatusBadge from '../components/ui/StatusBadge';
import { LoadingState } from '../components/ui/States';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

function SignedQuantity({ value }) {
  const n = Number(value);
  const tone = n > 0 ? 'text-moss-600' : n < 0 ? 'text-rust-600' : 'text-ink-500';
  return <span className={`tabular-nums ${tone}`}>{n > 0 ? '+' : ''}{formatNumber(n)}</span>;
}

export default function Adjustments() {
  const { user } = useAuth();
  const canCreate = can(user.role, 'requestAdjustment');
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => { listWarehouses({ status: 'ACTIVE', limit: 100 }).then((d) => setWarehouses(d.warehouses)).catch(() => {}); }, []);

  const [warehouseId, setWarehouseId] = useState(undefined);
  const [reason, setReason] = useState(undefined);
  const [status, setStatus] = useState(undefined);

  const { data, loading, error, page, setPage, reload } = useListPage(listAdjustments, { warehouseId, reason, status });

  const [adding, setAdding] = useState(false);

  const columns = [
    { key: 'adjustmentNumber', header: 'Adjustment number' },
    { key: 'item', header: 'Item', render: (r) => r.item.name },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouse.name },
    { key: 'systemQuantity', header: 'System qty', className: 'text-right', render: (r) => formatNumber(r.systemQuantity) },
    { key: 'physicalQuantity', header: 'Physical qty', className: 'text-right', render: (r) => formatNumber(r.physicalQuantity) },
    { key: 'difference', header: 'Difference', className: 'text-right', render: (r) => <SignedQuantity value={r.difference} /> },
    { key: 'reason', header: 'Reason', render: (r) => toSentenceCase(r.reason) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">Stock adjustments</h1>
          <p className="text-sm text-ink-500 mt-0.5">Physical counts reconciled against system quantity.</p>
        </div>
        {canCreate && (
          <Button icon={Plus} onClick={() => setAdding(true)}>
            New adjustment
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.adjustments || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No stock adjustments found."
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/adjustments/${row.id}`)}
        toolbar={
          <>
            <Select
              value={warehouseId}
              onChange={setWarehouseId}
              placeholder="All warehouses"
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
            <Select value={reason} onChange={setReason} placeholder="All reasons" options={ADJUSTMENT_REASON_OPTIONS} />
            <Select value={status} onChange={setStatus} placeholder="All statuses" options={STATUS_OPTIONS} />
          </>
        }
      />

      {adding && (
        <AdjustmentFormModal
          onClose={() => setAdding(false)}
          onSaved={(adjustment) => { setAdding(false); navigate(`/adjustments/${adjustment.id}`); }}
        />
      )}
    </div>
  );
}

function AdjustmentFormModal({ onClose, onSaved }) {
  const [items, setItems] = useState(null);
  const [warehouses, setWarehouses] = useState(null);
  useEffect(() => {
    Promise.all([listItems({ status: 'ACTIVE', limit: 200 }), listWarehouses({ status: 'ACTIVE', limit: 100 })]).then(([i, w]) => {
      setItems(i.items);
      setWarehouses(w.warehouses);
    });
  }, []);

  const [itemId, setItemId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [physicalQuantity, setPhysicalQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);

  const [currentQty, setCurrentQty] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Live-look up the system quantity for the chosen item/warehouse, purely as a
  // preview — the backend re-snapshots it itself at submission time regardless.
  useEffect(() => {
    if (!itemId || !warehouseId) { setCurrentQty(null); return; }
    setLookupLoading(true);
    getItemInventory(Number(itemId))
      .then((d) => {
        const row = d.byWarehouse.find((b) => b.warehouse.id === Number(warehouseId));
        setCurrentQty(row ? row.quantity : 0);
      })
      .catch(() => setCurrentQty(null))
      .finally(() => setLookupLoading(false));
  }, [itemId, warehouseId]);

  const difference = currentQty != null && physicalQuantity !== '' ? Number(physicalQuantity) - Number(currentQty) : null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const adjustment = await createAdjustment({
        itemId: Number(itemId),
        warehouseId: Number(warehouseId),
        physicalQuantity: Number(physicalQuantity),
        reason,
        remarks: remarks || undefined,
      });
      toast.success(`${adjustment.adjustmentNumber} created — awaiting approval`);
      onSaved(adjustment);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!items || !warehouses) return <Modal title="New stock adjustment" onClose={onClose}><LoadingState /></Modal>;

  return (
    <Modal title="New stock adjustment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Item" required>
            <select className={inputClass} value={itemId} onChange={(e) => setItemId(e.target.value)} required>
              <option value="" disabled>Select item</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.name}</option>)}
            </select>
          </FormField>
          <FormField label="Warehouse" required>
            <select className={inputClass} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="" disabled>Select warehouse</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </FormField>
        </div>

        {itemId && warehouseId && (
          <p className="text-xs text-ink-500">
            {lookupLoading ? 'Looking up current stock…' : currentQty != null ? `Current system quantity: ${formatNumber(currentQty)}` : 'Could not look up current stock'}
          </p>
        )}

        <FormField label="Physical quantity counted" required>
          <input type="number" min="0" step="any" className={inputClass} value={physicalQuantity} onChange={(e) => setPhysicalQuantity(e.target.value)} required />
        </FormField>

        {difference != null && (
          <p className="text-sm">
            Difference: <SignedQuantity value={difference} />
          </p>
        )}

        <FormField label="Reason" required>
          <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="" disabled>Select reason</option>
            {ADJUSTMENT_REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </FormField>
        <FormField label="Remarks">
          <textarea className={inputClass} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} />
        </FormField>

        <p className="text-xs text-ink-500">This only creates a request — stock isn't affected until an admin approves it.</p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Submit for approval'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export { SignedQuantity };
