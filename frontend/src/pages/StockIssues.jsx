import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { listStockIssues } from '../api/stockIssues';
import { useListPage } from '../hooks/useListPage';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { DEPARTMENT_OPTIONS } from '../config/options';
import { formatDate, toSentenceCase } from '../utils/format';
import { inputClass } from '../components/ui/FormField';
import DataTable from '../components/ui/DataTable';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function StockIssues() {
  const { user } = useAuth();
  const canCreate = can(user.role, 'issueStock');
  const navigate = useNavigate();

  const [department, setDepartment] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading, error, page, setPage, reload } = useListPage(listStockIssues, {
    department, status, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  });

  const columns = [
    { key: 'issueNumber', header: 'Issue number' },
    { key: 'department', header: 'Department', render: (r) => toSentenceCase(r.department) },
    { key: 'items', header: 'Lines', className: 'text-right', render: (r) => r.items.length },
    { key: 'issueDate', header: 'Date', render: (r) => formatDate(r.issueDate) },
    { key: 'requester', header: 'Requested by', render: (r) => r.requester.name },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">Stock issues</h1>
          <p className="text-sm text-ink-500 mt-0.5">Material issued out to departments.</p>
        </div>
        {canCreate && (
          <Button icon={Plus} onClick={() => navigate('/issues/new')}>
            New issue
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.issues || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No stock issues found."
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/issues/${row.id}`)}
        toolbar={
          <>
            <Select value={department} onChange={setDepartment} placeholder="All departments" options={DEPARTMENT_OPTIONS} />
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
