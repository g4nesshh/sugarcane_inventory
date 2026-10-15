import { useState, useEffect } from 'react';
import { listStockMovements } from '../api/stockMovements';
import { listItems } from '../api/items';
import { listWarehouses } from '../api/warehouses';
import { useListPage } from '../hooks/useListPage';
import { MOVEMENT_TYPE_OPTIONS, INCOMING_MOVEMENT_TYPES } from '../config/options';
import { formatNumber, formatDateTime, toSentenceCase } from '../utils/format';
import { inputClass } from '../components/ui/FormField';
import DataTable from '../components/ui/DataTable';
import Select from '../components/ui/Select';

export default function StockMovements() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    listItems({ limit: 100 }).then((d) => setItems(d.items)).catch(() => {});
    listWarehouses({ limit: 100 }).then((d) => setWarehouses(d.warehouses)).catch(() => {});
  }, []);

  const [itemId, setItemId] = useState(undefined);
  const [warehouseId, setWarehouseId] = useState(undefined);
  const [type, setType] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading, error, page, setPage, reload } = useListPage(listStockMovements, {
    itemId, warehouseId, type, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  });

  const columns = [
    { key: 'createdAt', header: 'Date', render: (r) => formatDateTime(r.createdAt) },
    { key: 'item', header: 'Item', render: (r) => r.item.name },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouse.name },
    { key: 'type', header: 'Type', render: (r) => <span className="text-xs">{toSentenceCase(r.type)}</span> },
    {
      key: 'quantity',
      header: 'Quantity',
      className: 'text-right',
      render: (r) => {
        const incoming = INCOMING_MOVEMENT_TYPES.has(r.type);
        return (
          <span className={`tabular-nums font-medium ${incoming ? 'text-moss-600' : 'text-rust-600'}`}>
            {incoming ? '+' : '−'}{formatNumber(r.quantity)} {r.item.unit}
          </span>
        );
      },
    },
    {
      key: 'balance',
      header: 'Balance',
      className: 'text-right text-ink-500',
      render: (r) => (
        <span className="tabular-nums text-xs">
          {formatNumber(r.previousQuantity)} → {formatNumber(r.newQuantity)}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (r) => (
        <span className="text-xs text-ink-500">
          {toSentenceCase(r.referenceType)}{r.referenceNumber ? ` · ${r.referenceNumber}` : ''}
        </span>
      ),
    },
    { key: 'performedBy', header: 'By', render: (r) => r.user.name },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-900">Stock movement ledger</h1>
        <p className="text-sm text-ink-500 mt-0.5">Every inventory change, immutable, oldest edits never possible.</p>
      </div>

      <DataTable
        columns={columns}
        rows={data?.movements || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No stock movements found."
        meta={data?.meta}
        onPageChange={setPage}
        toolbar={
          <>
            <Select
              value={itemId}
              onChange={setItemId}
              placeholder="All items"
              options={items.map((i) => ({ value: i.id, label: i.name }))}
            />
            <Select
              value={warehouseId}
              onChange={setWarehouseId}
              placeholder="All warehouses"
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
            <Select value={type} onChange={setType} placeholder="All movement types" options={MOVEMENT_TYPE_OPTIONS} />
            <div className="flex items-center gap-1.5 text-sm text-ink-500">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputClass} mt-0 w-36`} />
              <span>to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputClass} mt-0 w-36`} />
            </div>
          </>
        }
      />
    </div>
  );
}
