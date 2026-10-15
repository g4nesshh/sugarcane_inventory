import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  getInventoryReport, getPurchaseReport, getConsumptionReport, getStockMovementReport, downloadReportCsv,
} from '../api/reports';
import { listCategories } from '../api/categories';
import { listWarehouses } from '../api/warehouses';
import { listSuppliers } from '../api/suppliers';
import { listItems } from '../api/items';
import { useReport } from '../hooks/useReport';
import { MOVEMENT_TYPE_OPTIONS, INCOMING_MOVEMENT_TYPES } from '../config/options';
import { errorMessage } from '../api/client';
import { formatCurrency, formatNumber, formatMonth, formatDate, formatDateTime, toSentenceCase } from '../utils/format';
import DataTable from '../components/ui/DataTable';
import KpiStrip from '../components/ui/KpiStrip';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import { inputClass } from '../components/ui/FormField';

const TABS = [
  { key: 'inventory', label: 'Inventory' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'consumption', label: 'Consumption' },
  { key: 'stock-movement', label: 'Stock movement' },
];

const AXIS_STYLE = { fontSize: 12, fill: '#5c6b60' };

export default function Reports() {
  const [tab, setTab] = useState('inventory');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-900">Reports</h1>
        <p className="text-sm text-ink-500 mt-0.5">Inventory, purchasing, consumption, and stock-movement reports.</p>
      </div>

      <div className="flex gap-1 border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-cane-500 text-cane-700' : 'border-transparent text-ink-500 hover:text-ink-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inventory' && <InventoryReportTab />}
      {tab === 'purchases' && <PurchaseReportTab />}
      {tab === 'consumption' && <ConsumptionReportTab />}
      {tab === 'stock-movement' && <StockMovementReportTab />}
    </div>
  );
}

// Small label/value breakdown panel shared across tabs' summary sections.
function BreakdownList({ title, rows, labelKey, valueKey, formatValue = formatNumber }) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-500 text-center py-4">No data.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="text-ink-700">{r[labelKey]}</span>
              <span className="text-ink-900 tabular-nums font-medium">{formatValue(r[valueKey])}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MonthlyChart({ title, data, dataKey, formatValue }) {
  return (
    <Panel title={title}>
      {data.length === 0 ? (
        <p className="text-sm text-ink-500 text-center py-10">No data in range.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d7" vertical={false} />
            <XAxis dataKey="month" tick={AXIS_STYLE} tickFormatter={formatMonth} />
            <YAxis tick={AXIS_STYLE} width={56} tickFormatter={formatValue} />
            <Tooltip labelFormatter={formatMonth} formatter={formatValue} />
            <Bar dataKey={dataKey} fill="#1f4d36" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function ExportButton({ onExport }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      icon={Download}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onExport();
        } catch (err) {
          toast.error(err.isReadableReportError ? err.message : errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Exporting…' : 'Export CSV'}
    </Button>
  );
}

function DateRangeInputs({ dateFrom, setDateFrom, dateTo, setDateTo }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-ink-500">
      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputClass} mt-0 w-36`} />
      <span>to</span>
      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputClass} mt-0 w-36`} />
    </div>
  );
}

function InventoryReportTab() {
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    listCategories({ limit: 100 }).then((d) => setCategories(d.categories)).catch(() => {});
    listWarehouses({ limit: 100 }).then((d) => setWarehouses(d.warehouses)).catch(() => {});
  }, []);

  const [categoryId, setCategoryId] = useState(undefined);
  const [warehouseId, setWarehouseId] = useState(undefined);
  const { data, loading, error, reload } = useReport(getInventoryReport, { categoryId, warehouseId });

  const columns = [
    { key: 'itemCode', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'category', header: 'Category' },
    { key: 'totalStock', header: 'Stock', className: 'text-right', render: (r) => `${formatNumber(r.totalStock)} ${r.unit}` },
    { key: 'reorderLevel', header: 'Reorder level', className: 'text-right', render: (r) => formatNumber(r.reorderLevel) },
    { key: 'stockStatus', header: 'Status', render: (r) => <StatusBadge status={r.stockStatus} /> },
    { key: 'unitCost', header: 'Unit cost', className: 'text-right', render: (r) => formatCurrency(r.unitCost) },
    { key: 'totalValue', header: 'Total value', className: 'text-right', render: (r) => formatCurrency(r.totalValue) },
    { key: 'warehouses', header: 'By warehouse', className: 'text-xs text-ink-500' },
  ];

  return (
    <div className="space-y-4">
      {data && (
        <KpiStrip
          items={[
            { label: 'Items', value: formatNumber(data.summary.totalItems) },
            { label: 'Total value', value: formatCurrency(data.summary.totalValue) },
            { label: 'Low stock', value: formatNumber(data.summary.lowStockCount), tone: data.summary.lowStockCount > 0 ? 'warning' : undefined },
            { label: 'Out of stock', value: formatNumber(data.summary.outOfStockCount), tone: data.summary.outOfStockCount > 0 ? 'danger' : undefined },
          ]}
        />
      )}
      <DataTable
        columns={columns}
        rows={data?.rows || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No items match these filters."
        toolbar={
          <>
            <Select value={categoryId} onChange={setCategoryId} placeholder="All categories" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            <Select value={warehouseId} onChange={setWarehouseId} placeholder="All warehouses" options={warehouses.map((w) => ({ value: w.id, label: w.name }))} />
            <span className="flex-1" />
            <ExportButton onExport={() => downloadReportCsv('inventory', { categoryId, warehouseId }, 'inventory-report.csv')} />
          </>
        }
      />
    </div>
  );
}

const PO_STATUS_OPTIONS = ['DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].map((s) => ({
  value: s, label: toSentenceCase(s),
}));

function PurchaseReportTab() {
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => { listSuppliers({ status: 'ACTIVE', limit: 100 }).then((d) => setSuppliers(d.suppliers)).catch(() => {}); }, []);

  const [supplierId, setSupplierId] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const filters = { supplierId, status, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
  const { data, loading, error, reload } = useReport(getPurchaseReport, filters);

  const columns = [
    { key: 'poNumber', header: 'PO number' },
    { key: 'supplier', header: 'Supplier' },
    { key: 'orderDate', header: 'Order date', render: (r) => formatDate(r.orderDate) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'totalAmount', header: 'Amount', className: 'text-right', render: (r) => formatCurrency(r.totalAmount) },
  ];

  return (
    <div className="space-y-4">
      {data && (
        <KpiStrip
          items={[
            { label: 'Orders', value: formatNumber(data.summary.totalOrders) },
            { label: 'Total amount', value: formatCurrency(data.summary.totalAmount) },
            { label: 'Pending', value: formatNumber(data.summary.pendingCount), tone: data.summary.pendingCount > 0 ? 'warning' : undefined },
          ]}
        />
      )}

      {data && (data.summary.bySupplier.length > 0 || data.summary.byMonth.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BreakdownList title="By supplier" rows={data.summary.bySupplier} labelKey="supplier" valueKey="totalAmount" formatValue={formatCurrency} />
          <MonthlyChart title="By month" data={data.summary.byMonth} dataKey="totalAmount" formatValue={formatCurrency} />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data?.rows || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No purchase orders match these filters."
        toolbar={
          <>
            <Select value={supplierId} onChange={setSupplierId} placeholder="All suppliers" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
            <Select value={status} onChange={setStatus} placeholder="All statuses" options={PO_STATUS_OPTIONS} />
            <DateRangeInputs dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />
            <span className="flex-1" />
            <ExportButton onExport={() => downloadReportCsv('purchases', filters, 'purchase-report.csv')} />
          </>
        }
      />
    </div>
  );
}

function ConsumptionReportTab() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    listItems({ status: 'ACTIVE', limit: 200 }).then((d) => setItems(d.items)).catch(() => {});
    listWarehouses({ status: 'ACTIVE', limit: 100 }).then((d) => setWarehouses(d.warehouses)).catch(() => {});
  }, []);

  const [itemId, setItemId] = useState(undefined);
  const [warehouseId, setWarehouseId] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const filters = { itemId, warehouseId, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
  const { data, loading, error, reload } = useReport(getConsumptionReport, filters);

  const columns = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'batchNumber', header: 'Batch' },
    { key: 'product', header: 'Product' },
    { key: 'item', header: 'Item' },
    { key: 'warehouse', header: 'Warehouse' },
    { key: 'department', header: 'Department', render: (r) => r.department || '—' },
    { key: 'quantityConsumed', header: 'Quantity', className: 'text-right', render: (r) => `${formatNumber(r.quantityConsumed)} ${r.unit}` },
  ];

  return (
    <div className="space-y-4">
      {data && (
        <KpiStrip
          items={[
            { label: 'Records', value: formatNumber(data.summary.totalRecords) },
            { label: 'Total quantity consumed', value: formatNumber(data.summary.totalQuantity) },
          ]}
        />
      )}

      {data && (data.summary.byDepartment.length > 0 || data.summary.byItem.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BreakdownList title="By department" rows={data.summary.byDepartment} labelKey="department" valueKey="quantity" />
          <BreakdownList title="By item" rows={data.summary.byItem} labelKey="item" valueKey="quantity" />
          <MonthlyChart title="By month" data={data.summary.byMonth} dataKey="quantity" formatValue={formatNumber} />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data?.rows || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No consumption records match these filters."
        toolbar={
          <>
            <Select value={itemId} onChange={setItemId} placeholder="All items" options={items.map((i) => ({ value: i.id, label: i.name }))} />
            <Select value={warehouseId} onChange={setWarehouseId} placeholder="All warehouses" options={warehouses.map((w) => ({ value: w.id, label: w.name }))} />
            <DateRangeInputs dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />
            <span className="flex-1" />
            <ExportButton onExport={() => downloadReportCsv('consumption', filters, 'consumption-report.csv')} />
          </>
        }
      />
    </div>
  );
}

function StockMovementReportTab() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    listItems({ limit: 200 }).then((d) => setItems(d.items)).catch(() => {});
    listWarehouses({ limit: 100 }).then((d) => setWarehouses(d.warehouses)).catch(() => {});
  }, []);

  const [itemId, setItemId] = useState(undefined);
  const [warehouseId, setWarehouseId] = useState(undefined);
  const [type, setType] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const filters = { itemId, warehouseId, type, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
  const { data, loading, error, reload } = useReport(getStockMovementReport, filters);

  const columns = [
    { key: 'date', header: 'Date', render: (r) => formatDateTime(r.date) },
    { key: 'item', header: 'Item' },
    { key: 'warehouse', header: 'Warehouse' },
    { key: 'type', header: 'Type', render: (r) => <span className="text-xs">{toSentenceCase(r.type)}</span> },
    {
      key: 'quantity', header: 'Quantity', className: 'text-right',
      render: (r) => {
        const incoming = INCOMING_MOVEMENT_TYPES.has(r.type);
        return <span className={`tabular-nums font-medium ${incoming ? 'text-moss-600' : 'text-rust-600'}`}>{incoming ? '+' : '−'}{formatNumber(r.quantity)} {r.unit}</span>;
      },
    },
    { key: 'reference', header: 'Reference', className: 'text-xs text-ink-500', render: (r) => `${toSentenceCase(r.referenceType)}${r.referenceNumber ? ` · ${r.referenceNumber}` : ''}` },
    { key: 'performedBy', header: 'By' },
  ];

  return (
    <div className="space-y-4">
      {data && (
        <KpiStrip items={[{ label: 'Movements', value: formatNumber(data.summary.totalMovements) }]} />
      )}

      {data && data.summary.byType.length > 0 && (
        <BreakdownList
          title="By movement type"
          rows={data.summary.byType.map((t) => ({ ...t, label: toSentenceCase(t.type) }))}
          labelKey="label"
          valueKey="quantity"
        />
      )}

      <DataTable
        columns={columns}
        rows={data?.rows || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No stock movements match these filters."
        toolbar={
          <>
            <Select value={itemId} onChange={setItemId} placeholder="All items" options={items.map((i) => ({ value: i.id, label: i.name }))} />
            <Select value={warehouseId} onChange={setWarehouseId} placeholder="All warehouses" options={warehouses.map((w) => ({ value: w.id, label: w.name }))} />
            <Select value={type} onChange={setType} placeholder="All types" options={MOVEMENT_TYPE_OPTIONS} />
            <DateRangeInputs dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} />
            <span className="flex-1" />
            <ExportButton onExport={() => downloadReportCsv('stock-movement', filters, 'stock-movement-report.csv')} />
          </>
        }
      />
    </div>
  );
}
