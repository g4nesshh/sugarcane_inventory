import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { listPurchaseOrders } from '../api/purchaseOrders';
import { listSuppliers } from '../api/suppliers';
import { useListPage } from '../hooks/useListPage';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { formatCurrency, formatDate } from '../utils/format';
import { inputClass } from '../components/ui/FormField';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';

const PO_STATUS_OPTIONS = ['DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].map((v) => ({
  value: v,
  label: v.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()),
}));

export default function PurchaseOrders() {
  const { user } = useAuth();
  const canManage = can(user.role, 'managePurchases');
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => {
    // Storekeeper can view POs but not Suppliers — this call 403s for them; fail silently,
    // the filter just has no options rather than breaking the page.
    listSuppliers({ limit: 100 }).then((d) => setSuppliers(d.suppliers)).catch(() => {});
  }, []);

  const [searchInput, setSearchInput] = useState('');
  const [supplierId, setSupplierId] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const search = useDebouncedValue(searchInput);

  const { data, loading, error, page, setPage, reload } = useListPage(listPurchaseOrders, {
    search, supplierId, status, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  });

  const columns = [
    { key: 'poNumber', header: 'PO number' },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier.name },
    { key: 'orderDate', header: 'Order date', render: (r) => formatDate(r.orderDate) },
    { key: 'items', header: 'Lines', className: 'text-right', render: (r) => r.items.length },
    { key: 'totalAmount', header: 'Total', className: 'text-right', render: (r) => formatCurrency(r.totalAmount) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">Purchase orders</h1>
          <p className="text-sm text-ink-500 mt-0.5">Orders placed with suppliers for materials.</p>
        </div>
        {canManage && (
          <Button icon={Plus} onClick={() => navigate('/purchases/new')}>
            New purchase order
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.purchaseOrders || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No purchase orders found."
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/purchases/${row.id}`)}
        toolbar={
          <>
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search PO number…" />
            {suppliers.length > 0 && (
              <Select
                value={supplierId}
                onChange={setSupplierId}
                placeholder="All suppliers"
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
            <Select value={status} onChange={setStatus} placeholder="All statuses" options={PO_STATUS_OPTIONS} />
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
