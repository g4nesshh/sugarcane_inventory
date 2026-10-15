import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { getProductionBatch, createProductionConsumption } from '../api/production';
import { listItems } from '../api/items';
import { listWarehouses } from '../api/warehouses';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { errorMessage } from '../api/client';
import { DEPARTMENT_OPTIONS } from '../config/options';
import { formatDate, formatNumber } from '../utils/format';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import LineItemsTable from '../components/ui/LineItemsTable';
import { LoadingState, ErrorState } from '../components/ui/States';

export default function ProductionBatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = can(user.role, 'recordConsumption');

  const [batch, setBatch] = useState(null);
  const [error, setError] = useState(null);
  const [recording, setRecording] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getProductionBatch(id).then(setBatch).catch((err) => setError(errorMessage(err)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!batch) return <LoadingState label="Loading batch…" />;

  return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => navigate('/production/batches')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Back to production batches
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">{batch.batchNumber}</h1>
          <p className="text-sm text-ink-500 mt-0.5">{batch.product}</p>
        </div>
        <StatusBadge status={batch.status} />
      </div>

      {canManage && batch.status !== 'COMPLETED' && (
        <Button icon={Plus} onClick={() => setRecording(true)}>
          Record consumption
        </Button>
      )}

      <Panel title="Details">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-500">Production date</dt>
          <dd className="text-ink-900">{formatDate(batch.productionDate)}</dd>
          <dt className="text-ink-500">Quantity produced</dt>
          <dd className="text-ink-900">{formatNumber(batch.quantityProduced)}</dd>
        </dl>
      </Panel>

      <Panel title="Materials consumed">
        {batch.consumptions.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-6">No consumption recorded against this batch yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-ink-500">
                <th className="font-medium py-2">Item</th>
                <th className="font-medium py-2">Warehouse</th>
                <th className="font-medium py-2">Department</th>
                <th className="font-medium py-2 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {batch.consumptions.map((c) => (
                <tr key={c.id} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 text-ink-900">{c.item.itemCode} — {c.item.name}</td>
                  <td className="py-2 text-ink-700">{c.warehouse.name}</td>
                  <td className="py-2 text-ink-700">{c.department || '—'}</td>
                  <td className="py-2 text-right tabular-nums">{formatNumber(c.quantityConsumed)} {c.item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {recording && (
        <RecordConsumptionModal
          batch={batch}
          onClose={() => setRecording(false)}
          onSaved={() => { setRecording(false); load(); }}
        />
      )}
    </div>
  );
}

const emptyLine = () => ({ itemId: '', warehouseId: '', quantityConsumed: '', department: '', remarks: '' });

function RecordConsumptionModal({ batch, onClose, onSaved }) {
  const [items, setItems] = useState(null);
  const [warehouses, setWarehouses] = useState(null);
  useEffect(() => {
    Promise.all([listItems({ status: 'ACTIVE', limit: 200 }), listWarehouses({ status: 'ACTIVE', limit: 100 })]).then(([i, w]) => {
      setItems(i.items);
      setWarehouses(w.warehouses);
    });
  }, []);

  const [lines, setLines] = useState([emptyLine()]);
  const [busy, setBusy] = useState(false);

  const updateLine = (idx, key, value) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const validLines = lines.filter((l) => l.itemId && l.warehouseId && l.quantityConsumed);

  const submit = async (e) => {
    e.preventDefault();
    if (validLines.length === 0) return toast.error('Add at least one line item');
    setBusy(true);
    try {
      await createProductionConsumption({
        productionBatchId: batch.id,
        items: validLines.map((l) => ({
          itemId: Number(l.itemId),
          warehouseId: Number(l.warehouseId),
          quantityConsumed: Number(l.quantityConsumed),
          department: l.department || undefined,
          remarks: l.remarks || undefined,
        })),
      });
      toast.success('Consumption recorded — stock deducted');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!items || !warehouses) return <Modal title="Record consumption" onClose={onClose}><LoadingState /></Modal>;

  return (
    <Modal title={`Record consumption — ${batch.batchNumber}`} onClose={onClose} width="max-w-3xl">
      <form onSubmit={submit} className="space-y-4">
        <LineItemsTable
          columns={[
            {
              key: 'itemId', header: 'Item', type: 'select', width: '26%', placeholder: 'Select item',
              options: items.map((i) => ({ value: i.id, label: `${i.itemCode} — ${i.name}` })),
            },
            {
              key: 'warehouseId', header: 'Warehouse', type: 'select', width: '20%', placeholder: 'Select warehouse',
              options: warehouses.map((w) => ({ value: w.id, label: w.name })),
            },
            { key: 'quantityConsumed', header: 'Quantity', type: 'number', width: '14%' },
            { key: 'department', header: 'Department', type: 'select', width: '18%', placeholder: 'Optional', options: DEPARTMENT_OPTIONS },
            { key: 'remarks', header: 'Remarks', type: 'text', width: '22%', placeholder: 'Optional' },
          ]}
          rows={lines}
          onRowChange={updateLine}
          onAddRow={addLine}
          onRemoveRow={removeLine}
          addLabel="Add line item"
        />
        <p className="text-xs text-ink-500">Stock is deducted immediately when this is submitted — there's no approval step for consumption.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Recording…' : 'Record consumption'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
