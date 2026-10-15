import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Ban } from 'lucide-react';
import { listSuppliers, createSupplier, updateSupplier, deactivateSupplier } from '../api/suppliers';
import { useListPage } from '../hooks/useListPage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { RECORD_STATUS_OPTIONS } from '../config/options';
import { errorMessage } from '../api/client';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FormField, { inputClass } from '../components/ui/FormField';
import StatusBadge from '../components/ui/StatusBadge';

export default function Suppliers() {
  const { user } = useAuth();
  const canManage = can(user.role, 'manageSuppliers');

  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState(undefined);
  const search = useDebouncedValue(searchInput);

  const { data, loading, error, page, setPage, reload } = useListPage(listSuppliers, { search, status });

  const [editing, setEditing] = useState(null);
  const [deactivating, setDeactivating] = useState(null);

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'contactPerson', header: 'Contact', render: (r) => r.contactPerson || <span className="text-ink-500">—</span> },
    { key: 'phone', header: 'Phone', render: (r) => r.phone || <span className="text-ink-500">—</span> },
    { key: 'supplierType', header: 'Type', render: (r) => r.supplierType || <span className="text-ink-500">—</span> },
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
          <h1 className="font-display text-xl font-semibold text-ink-900">Suppliers</h1>
          <p className="text-sm text-ink-500 mt-0.5">Vendors materials are purchased from.</p>
        </div>
        {canManage && (
          <Button icon={Plus} onClick={() => setEditing({})}>
            Add supplier
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.suppliers || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No suppliers found."
        meta={data?.meta}
        onPageChange={setPage}
        toolbar={
          <>
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search suppliers…" />
            <Select value={status} onChange={setStatus} options={RECORD_STATUS_OPTIONS} placeholder="All statuses" />
          </>
        }
      />

      {editing && (
        <SupplierFormModal
          supplier={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}

      {deactivating && (
        <ConfirmDialog
          title="Deactivate supplier"
          message={`Deactivate "${deactivating.name}"? Existing purchase orders keep referencing it.`}
          confirmLabel="Deactivate"
          tone="danger"
          onCancel={() => setDeactivating(null)}
          onConfirm={async () => {
            try {
              await deactivateSupplier(deactivating.id);
              toast.success('Supplier deactivated');
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

function SupplierFormModal({ supplier, onClose, onSaved }) {
  const isEdit = Boolean(supplier);
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contactPerson: supplier?.contactPerson || '',
    phone: supplier?.phone || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
    gstNumber: supplier?.gstNumber || '',
    supplierType: supplier?.supplierType || '',
    paymentTerms: supplier?.paymentTerms || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || undefined]));
      payload.name = form.name;
      if (isEdit) {
        await updateSupplier(supplier.id, payload);
        toast.success('Supplier updated');
      } else {
        await createSupplier(payload);
        toast.success('Supplier created');
      }
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit supplier' : 'Add supplier'} width="max-w-lg" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Name" required>
          <input className={inputClass} value={form.name} onChange={set('name')} required maxLength={150} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Contact person">
            <input className={inputClass} value={form.contactPerson} onChange={set('contactPerson')} maxLength={100} />
          </FormField>
          <FormField label="Phone">
            <input className={inputClass} value={form.phone} onChange={set('phone')} maxLength={20} />
          </FormField>
          <FormField label="Email">
            <input type="email" className={inputClass} value={form.email} onChange={set('email')} />
          </FormField>
          <FormField label="GST number">
            <input className={inputClass} value={form.gstNumber} onChange={set('gstNumber')} maxLength={20} />
          </FormField>
          <FormField label="Supplier type">
            <input className={inputClass} value={form.supplierType} onChange={set('supplierType')} maxLength={50} placeholder="Chemicals, Spares…" />
          </FormField>
          <FormField label="Payment terms">
            <input className={inputClass} value={form.paymentTerms} onChange={set('paymentTerms')} maxLength={50} placeholder="Net 30" />
          </FormField>
        </div>
        <FormField label="Address">
          <textarea className={inputClass} rows={2} value={form.address} onChange={set('address')} maxLength={300} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create supplier'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
