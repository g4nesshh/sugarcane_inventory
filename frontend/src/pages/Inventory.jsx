import { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { listInventory, getItemInventory } from '../api/inventory';
import { listCategories } from '../api/categories';
import { listWarehouses } from '../api/warehouses';
import { useListPage } from '../hooks/useListPage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { RECORD_STATUS_OPTIONS, STOCK_STATUS_OPTIONS } from '../config/options';
import { formatNumber, formatCurrency, formatDateTime } from '../utils/format';
import { errorMessage } from '../api/client';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import { LoadingState, ErrorState } from '../components/ui/States';

export default function Inventory() {
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
  const search = useDebouncedValue(searchInput);

  const { data, loading, error, page, setPage, reload } = useListPage(listInventory, {
    search, categoryId, warehouseId, stockStatus,
  });

  const [viewingItemId, setViewingItemId] = useState(null);

  const columns = [
    { key: 'itemCode', header: 'Code' },
    { key: 'itemName', header: 'Item' },
    { key: 'category', header: 'Category', render: (r) => r.category?.name },
    { key: 'warehouseName', header: 'Warehouse' },
    {
      key: 'quantity',
      header: 'Quantity',
      className: 'text-right',
      render: (r) => <span className="tabular-nums">{formatNumber(r.quantity)} {r.unit}</span>,
    },
    { key: 'stockStatus', header: 'Status', render: (r) => <StatusBadge status={r.stockStatus} /> },
    { key: 'stockValue', header: 'Value', className: 'text-right', render: (r) => formatCurrency(r.stockValue) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <button
          onClick={() => setViewingItemId(r.itemId)}
          className="p-1.5 rounded hover:bg-stone-100 text-ink-500 hover:text-ink-900"
          title="View breakdown by warehouse"
        >
          <Eye size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-900">Inventory</h1>
        <p className="text-sm text-ink-500 mt-0.5">Current stock by item and warehouse.</p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.inventory || []}
        rowKey={(r) => `${r.itemId}-${r.warehouseId}`}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No inventory records found."
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
          </>
        }
      />

      {viewingItemId && <ItemBreakdownModal itemId={viewingItemId} onClose={() => setViewingItemId(null)} />}
    </div>
  );
}

function ItemBreakdownModal({ itemId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    getItemInventory(itemId).then(setData).catch((err) => setError(errorMessage(err)));
  }, [itemId]);

  return (
    <Modal title={data ? `${data.item.name} — stock by warehouse` : 'Stock by warehouse'} onClose={onClose}>
      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-500">Total stock</span>
            <span className="font-medium text-ink-900 tabular-nums">
              {formatNumber(data.totalStock)} {data.item.unit} <StatusBadge status={data.stockStatus} />
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-500">Total value</span>
            <span className="font-medium text-ink-900">{formatCurrency(data.totalValue)}</span>
          </div>
          <table className="w-full text-sm border-t border-stone-200 pt-2">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="font-medium py-2">Warehouse</th>
                <th className="font-medium py-2 text-right">Quantity</th>
                <th className="font-medium py-2 text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.byWarehouse.map((row) => (
                <tr key={row.warehouse.id} className="border-t border-stone-100">
                  <td className="py-2 text-ink-900">{row.warehouse.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatNumber(row.quantity)} {data.item.unit}</td>
                  <td className="py-2 text-right text-ink-500 text-xs">{formatDateTime(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
