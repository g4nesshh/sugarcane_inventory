import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Pencil } from 'lucide-react';
import { listProductionBatches, createProductionBatch, updateProductionBatch } from '../api/production';
import { useListPage } from '../hooks/useListPage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { BATCH_STATUS_OPTIONS } from '../config/options';
import { errorMessage } from '../api/client';
import { formatDate, formatNumber } from '../utils/format';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField, { inputClass } from '../components/ui/FormField';
import StatusBadge from '../components/ui/StatusBadge';

export default function ProductionBatches() {
  const { user } = useAuth();
  const canManage = can(user.role, 'recordConsumption');
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState(undefined);
  const search = useDebouncedValue(searchInput);

  const { data, loading, error, page, setPage, reload } = useListPage(listProductionBatches, { search, status });

  const [editing, setEditing] = useState(null);

  const columns = [
    { key: 'batchNumber', header: 'Batch number' },
    { key: 'product', header: 'Product' },
    { key: 'productionDate', header: 'Date', render: (r) => formatDate(r.productionDate) },
    { key: 'quantityProduced', header: 'Quantity produced', className: 'text-right', render: (r) => formatNumber(r.quantityProduced) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (r) => (
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(r); }}
                className="p-1.5 rounded hover:bg-stone-100 text-ink-500 hover:text-ink-900"
              >
                <Pencil size={14} />
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">Production batches</h1>
          <p className="text-sm text-ink-500 mt-0.5">Production runs and the materials consumed against them.</p>
        </div>
        {canManage && (
          <Button icon={Plus} onClick={() => setEditing({})}>
            New batch
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.batches || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No production batches found."
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/production/batches/${row.id}`)}
        toolbar={
          <>
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search batches…" />
            <Select value={status} onChange={setStatus} placeholder="All statuses" options={BATCH_STATUS_OPTIONS} />
          </>
        }
      />

      {editing && (
        <BatchFormModal
          batch={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(batch) => { setEditing(null); if (editing.id) reload(); else navigate(`/production/batches/${batch.id}`); }}
        />
      )}
    </div>
  );
}

function BatchFormModal({ batch, onClose, onSaved }) {
  const isEdit = Boolean(batch);
  const [product, setProduct] = useState(batch?.product || '');
  const [productionDate, setProductionDate] = useState(batch?.productionDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [quantityProduced, setQuantityProduced] = useState(batch?.quantityProduced ?? 0);
  const [status, setStatus] = useState(batch?.status || 'PLANNED');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      let saved;
      if (isEdit) {
        saved = await updateProductionBatch(batch.id, { product, productionDate, quantityProduced: Number(quantityProduced), status });
        toast.success('Batch updated');
      } else {
        saved = await createProductionBatch({ product, productionDate, quantityProduced: Number(quantityProduced) });
        toast.success(`${saved.batchNumber} created`);
      }
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit batch' : 'New production batch'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Product" required>
          <input className={inputClass} value={product} onChange={(e) => setProduct(e.target.value)} required maxLength={150} />
        </FormField>
        <FormField label="Production date">
          <input type="date" className={inputClass} value={productionDate} onChange={(e) => setProductionDate(e.target.value)} />
        </FormField>
        <FormField label="Quantity produced">
          <input type="number" min="0" step="any" className={inputClass} value={quantityProduced} onChange={(e) => setQuantityProduced(e.target.value)} />
        </FormField>
        {isEdit && (
          <FormField label="Status">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {BATCH_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </FormField>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create batch'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
