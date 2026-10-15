import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { listStockTransfers } from '../api/stockTransfers';
import { listWarehouses } from '../api/warehouses';
import { useListPage } from '../hooks/useListPage';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { formatDate } from '../utils/format';
import { inputClass } from '../components/ui/FormField';
import DataTable from '../components/ui/DataTable';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function StockTransfers() {
  const { user } = useAuth();
  const canCreate = can(user.role, 'transferStock');
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => { listWarehouses({ limit: 100 }).then((d) => setWarehouses(d.warehouses)).catch(() => {}); }, []);

  const [sourceWarehouseId, setSourceWarehouseId] = useState(undefined);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading, error, page, setPage, reload } = useListPage(listStockTransfers, {
    sourceWarehouseId, destinationWarehouseId, status, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  });

  const warehouseOptions = warehouses.map((w) => ({ value: w.id, label: w.name }));

  const columns = [
    { key: 'transferNumber', header: 'Transfer number' },
    { key: 'source', header: 'From', render: (r) => r.source.name },
    { key: 'destination', header: 'To', render: (r) => r.destination.name },
    { key: 'items', header: 'Lines', className: 'text-right', render: (r) => r.items.length },
    { key: 'createdAt', header: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">Stock transfers</h1>
          <p className="text-sm text-ink-500 mt-0.5">Stock moved between warehouses.</p>
        </div>
        {canCreate && (
          <Button icon={Plus} onClick={() => navigate('/transfers/new')}>
            New transfer
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.transfers || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No stock transfers found."
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/transfers/${row.id}`)}
        toolbar={
          <>
            <Select value={sourceWarehouseId} onChange={setSourceWarehouseId} placeholder="Any source" options={warehouseOptions} />
            <Select value={destinationWarehouseId} onChange={setDestinationWarehouseId} placeholder="Any destination" options={warehouseOptions} />
            <Select value={status} onChange={setStatus} placeholder="All statuses" options={STATUS_OPTIONS} />
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
