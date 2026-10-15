import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Ban } from 'lucide-react';
import { listItems, createItem, updateItem, deactivateItem } from '../api/items';
import { listCategories } from '../api/categories';
import { listWarehouses } from '../api/warehouses';
import { useListPage } from '../hooks/useListPage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { errorMessage } from '../api/client';
import { formatNumber, formatCurrency } from '../utils/format';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FormField, { inputClass } from '../components/ui/FormField';
import StatusBadge from '../components/ui/StatusBadge';
import { RECORD_STATUS_OPTIONS, STOCK_STATUS_OPTIONS } from '../config/options';

export default function Items() {
  const { user } = useAuth();
  const canManage = can(user.role, 'manageItems');

  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    listCategories({ limit: 100 }).then((d) => setCategories(d.categories)).catch(() => {});
    listWarehouses({ limit: 100 }).then((d) => setWarehouses(d.warehouses)).catch(() => {});
  }, []);

  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState(undefined);
  const [warehouseId, setWarehouseId] = useState(undefined);
  const [stockStatus, setStockStatus] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const search = useDebouncedValue(searchInput);

  const { data, loading, error, page, setPage, reload } = useListPage(listItems, {
    search, categoryId, warehouseId, stockStatus, status,
  });

  const [editing, setEditing] = useState(null);
  const [deactivating, setDeactivating] = useState(null);

  const columns = [
    { key: 'itemCode', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category', render: (r) => r.category.name },
    {
      key: 'totalStock',
      header: 'Stock',
      className: 'text-right',
      render: (r) => <span className="tabular-nums">{formatNumber(r.totalStock)} {r.unit}</span>,
    },
    { key: 'stockStatus', header: 'Status', render: (r) => <StatusBadge status={r.stockStatus} /> },
    { key: 'unitCost', header: 'Unit cost', className: 'text-right', render: (r) => formatCurrency(r.unitCost) },
    { key: 'recordStatus', header: '', render: (r) => <StatusBadge status={r.status} /> },
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
          <h1 className="font-display text-xl font-semibold text-ink-900">Items</h1>
          <p className="text-sm text-ink-500 mt-0.5">Raw materials, spares, and finished products.</p>
        </div>
        {canManage && (
          <Button icon={Plus} onClick={() => setEditing({})}>
            Add item
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.items || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No items found."
        meta={data?.meta}
        onPageChange={setPage}
        toolbar={
          <>
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search items…" />
            <Select
              value={categoryId}
              onChange={setCategoryId}
              placeholder="All categories"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              value={warehouseId}
              onChange={setWarehouseId}
              placeholder="All warehouses"
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
            <Select value={stockStatus} onChange={setStockStatus} placeholder="All stock levels" options={STOCK_STATUS_OPTIONS} />
            <Select value={status} onChange={setStatus} placeholder="All statuses" options={RECORD_STATUS_OPTIONS} />
          </>
        }
      />

      {editing && (
        <ItemFormModal
          item={editing.id ? editing : null}
          categories={categories.filter((c) => c.status === 'ACTIVE')}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}

      {deactivating && (
        <ConfirmDialog
          title="Deactivate item"
          message={`Deactivate "${deactivating.name}"? It will no longer be selectable for new transactions.`}
          confirmLabel="Deactivate"
          tone="danger"
          onCancel={() => setDeactivating(null)}
          onConfirm={async () => {
            try {
              await deactivateItem(deactivating.id);
              toast.success('Item deactivated');
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

function ItemFormModal({ item, categories, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [form, setForm] = useState({
    itemCode: item?.itemCode || '',
    name: item?.name || '',
    categoryId: item?.category?.id || '',
    unit: item?.unit || '',
    description: item?.description || '',
    minimumStock: item?.minimumStock ?? 0,
    maximumStock: item?.maximumStock ?? 0,
    reorderLevel: item?.reorderLevel ?? 0,
    unitCost: item?.unitCost ?? 0,
  });
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
        minimumStock: Number(form.minimumStock),
        maximumStock: Number(form.maximumStock),
        reorderLevel: Number(form.reorderLevel),
        unitCost: Number(form.unitCost),
        description: form.description || undefined,
      };
      if (isEdit) {
        await updateItem(item.id, payload);
        toast.success('Item updated');
      } else {
        await createItem(payload);
        toast.success('Item created');
      }
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isEdit ? 'Edit item' : 'Add item'} width="max-w-lg" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Item code" required>
            <input className={inputClass} value={form.itemCode} onChange={set('itemCode')} required maxLength={50} disabled={isEdit} />
          </FormField>
          <FormField label="Unit" required>
            <input className={inputClass} value={form.unit} onChange={set('unit')} required maxLength={20} placeholder="KG, L, PCS…" />
          </FormField>
        </div>
        <FormField label="Name" required>
          <input className={inputClass} value={form.name} onChange={set('name')} required maxLength={150} />
        </FormField>
        <FormField label="Category" required>
          <select className={inputClass} value={form.categoryId} onChange={set('categoryId')} required>
            <option value="" disabled>Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Description">
          <textarea className={inputClass} rows={2} value={form.description} onChange={set('description')} maxLength={1000} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Minimum stock">
            <input type="number" min="0" step="any" className={inputClass} value={form.minimumStock} onChange={set('minimumStock')} />
          </FormField>
          <FormField label="Maximum stock">
            <input type="number" min="0" step="any" className={inputClass} value={form.maximumStock} onChange={set('maximumStock')} />
          </FormField>
          <FormField label="Reorder level">
            <input type="number" min="0" step="any" className={inputClass} value={form.reorderLevel} onChange={set('reorderLevel')} />
          </FormField>
          <FormField label="Unit cost">
            <input type="number" min="0" step="any" className={inputClass} value={form.unitCost} onChange={set('unitCost')} />
          </FormField>
        </div>
        <p className="text-xs text-ink-500">
          Supplier assignment and opening stock are set from the Suppliers and Goods Receipts pages once built.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
