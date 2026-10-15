import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Ban } from 'lucide-react';
import { listWarehouses, createWarehouse, updateWarehouse, deactivateWarehouse } from '../api/warehouses';
import { useListPage } from '../hooks/useListPage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { errorMessage } from '../api/client';
import { formatNumber } from '../utils/format';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FormField, { inputClass } from '../components/ui/FormField';
import StatusBadge from '../components/ui/StatusBadge';
import { RECORD_STATUS_OPTIONS } from '../config/options';

export default function Warehouses() {
  const { user } = useAuth();
  const canManage = can(user.role, 'manageWarehouses');

  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState(undefined);
  const search = useDebouncedValue(searchInput);

  const { data, loading, error, page, setPage, reload } = useListPage(listWarehouses, { search, status });

  const [editing, setEditing] = useState(null);
  const [deactivating, setDeactivating] = useState(null);

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'location', header: 'Location', render: (r) => r.location || <span className="text-ink-500">—</span> },
    { key: 'manager', header: 'Manager', render: (r) => r.manager || <span className="text-ink-500">—</span> },
    { key: 'capacity', header: 'Capacity', render: (r) => (r.capacity != null ? formatNumber(r.capacity) : <span className="text-ink-500">—</span>) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button onClick={() => setEditing(r)} className="p-1.5 rounded hover:bg-stone-100 text-ink-500 hover:text-ink-900">
                  <Pencil size={14} />
                </button>
                {r.status === 'ACTIVE' && (
                  <button onClick={() => setDeactivating(r)} className="p-1.5 rounded hover:bg-stone-100 text-ink-500 hover:text-rust-600">
                    <Ban size={14} />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">Warehouses</h1>
          <p className="text-sm text-ink-500 mt-0.5">Storage locations stock is tracked against.</p>
        </div>
        {canManage && (
          <Button icon={Plus} onClick={() => setEditing({})}>
            Add warehouse
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.warehouses || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No warehouses found."
        meta={data?.meta}
        onPageChange={setPage}
        toolbar={
          <>
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search warehouses…" />
            <Select value={status} onChange={setStatus} options={RECORD_STATUS_OPTIONS} placeholder="All statuses" />
          </>
        }
      />

      {editing && (
        <WarehouseFormModal
          warehouse={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}

      {deactivating && (
        <ConfirmDialog
          title="Deactivate warehouse"
          message={`Deactivate "${deactivating.name}"? This fails if the warehouse still holds stock.`}
          confirmLabel="Deactivate"
          tone="danger"
          onCancel={() => setDeactivating(null)}
          onConfirm={async () => {
            try {
              await deactivateWarehouse(deactivating.id);
              toast.success('Warehouse deactivated');
              setDeactivating(null);
              reload();
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }}
        />
      )}
    </div>
  );
}

function WarehouseFormModal({ warehouse, onClose, onSaved }) {
  const isEdit = Boolean(warehouse);
  const [name, setName] = useState(warehouse?.name || '');
  const [location, setLocation] = useState(warehouse?.location || '');
  const [manager, setManager] = useState(warehouse?.manager || '');
  const [capacity, setCapacity] = useState(warehouse?.capacity ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name,
        location: location || undefined,
        manager: manager || undefined,
        capacity: capacity === '' ? undefined : Number(capacity),
      };
      if (isEdit) {
        await updateWarehouse(warehouse.id, payload);
        toast.success('Warehouse updated');
      } else {
        await createWarehouse(payload);
        toast.success('Warehouse created');
      }
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit warehouse' : 'Add warehouse'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Name" required>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </FormField>
        <FormField label="Location">
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
        </FormField>
        <FormField label="Manager">
          <input className={inputClass} value={manager} onChange={(e) => setManager(e.target.value)} maxLength={100} />
        </FormField>
        <FormField label="Capacity">
          <input type="number" min="0" step="any" className={inputClass} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create warehouse'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
