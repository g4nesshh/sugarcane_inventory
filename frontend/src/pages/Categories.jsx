import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Ban } from 'lucide-react';
import { listCategories, createCategory, updateCategory, deactivateCategory } from '../api/categories';
import { useListPage } from '../hooks/useListPage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { errorMessage } from '../api/client';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FormField, { inputClass } from '../components/ui/FormField';
import StatusBadge from '../components/ui/StatusBadge';
import { RECORD_STATUS_OPTIONS } from '../config/options';

export default function Categories() {
  const { user } = useAuth();
  const canManage = can(user.role, 'manageCategories');

  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState(undefined);
  const search = useDebouncedValue(searchInput);

  const { data, loading, error, page, setPage, reload } = useListPage(listCategories, { search, status });

  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [deactivating, setDeactivating] = useState(null);

  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description', render: (r) => r.description || <span className="text-ink-500">—</span> },
    { key: 'items', header: 'Items', render: (r) => r._count.items },
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
          <h1 className="font-display text-xl font-semibold text-ink-900">Categories</h1>
          <p className="text-sm text-ink-500 mt-0.5">Item categories used across inventory.</p>
        </div>
        {canManage && (
          <Button icon={Plus} onClick={() => setEditing({})}>
            Add category
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.categories || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No categories found."
        meta={data?.meta}
        onPageChange={setPage}
        toolbar={
          <>
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search categories…" />
            <Select value={status} onChange={setStatus} options={RECORD_STATUS_OPTIONS} placeholder="All statuses" />
          </>
        }
      />

      {editing && (
        <CategoryFormModal
          category={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}

      {deactivating && (
        <ConfirmDialog
          title="Deactivate category"
          message={`Deactivate "${deactivating.name}"? It will no longer be selectable for new items, but existing items keep it.`}
          confirmLabel="Deactivate"
          tone="danger"
          onCancel={() => setDeactivating(null)}
          onConfirm={async () => {
            try {
              await deactivateCategory(deactivating.id);
              toast.success('Category deactivated');
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

function CategoryFormModal({ category, onClose, onSaved }) {
  const isEdit = Boolean(category);
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { name, description: description || undefined };
      if (isEdit) {
        await updateCategory(category.id, payload);
        toast.success('Category updated');
      } else {
        await createCategory(payload);
        toast.success('Category created');
      }
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit category' : 'Add category'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Name" required>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </FormField>
        <FormField label="Description">
          <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
