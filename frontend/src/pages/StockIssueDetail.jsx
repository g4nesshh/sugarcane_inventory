import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { getStockIssue, approveStockIssue, rejectStockIssue } from '../api/stockIssues';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { errorMessage } from '../api/client';
import { formatDate, toSentenceCase } from '../utils/format';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { LoadingState, ErrorState } from '../components/ui/States';

export default function StockIssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canDecide = can(user.role, 'approveIssueOrTransfer');

  const [issue, setIssue] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null); // 'approve' | 'reject' | null
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getStockIssue(id).then(setIssue).catch((err) => setError(errorMessage(err)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!issue) return <LoadingState label="Loading stock issue…" />;

  const decide = async () => {
    setBusy(true);
    try {
      if (confirming === 'approve') {
        await approveStockIssue(id);
        toast.success('Issue approved — stock deducted');
      } else {
        await rejectStockIssue(id);
        toast.success('Issue rejected');
      }
      setConfirming(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => navigate('/issues')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Back to stock issues
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">{issue.issueNumber}</h1>
          <p className="text-sm text-ink-500 mt-0.5">{toSentenceCase(issue.department)}</p>
        </div>
        <StatusBadge status={issue.status} />
      </div>

      {canDecide && issue.status === 'PENDING' && (
        <div className="flex gap-2">
          <Button onClick={() => setConfirming('approve')}>Approve</Button>
          <Button variant="danger" onClick={() => setConfirming('reject')}>Reject</Button>
        </div>
      )}

      <Panel title="Details">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-500">Requested by</dt>
          <dd className="text-ink-900">{issue.requester.name}</dd>
          <dt className="text-ink-500">Date</dt>
          <dd className="text-ink-900">{formatDate(issue.issueDate)}</dd>
          {issue.purpose && (
            <>
              <dt className="text-ink-500">Purpose</dt>
              <dd className="text-ink-900">{issue.purpose}</dd>
            </>
          )}
          {issue.approver && (
            <>
              <dt className="text-ink-500">{issue.status === 'REJECTED' ? 'Rejected by' : 'Approved by'}</dt>
              <dd className="text-ink-900">{issue.approver.name}</dd>
            </>
          )}
          {issue.remarks && (
            <>
              <dt className="text-ink-500">Remarks</dt>
              <dd className="text-ink-900">{issue.remarks}</dd>
            </>
          )}
        </dl>
      </Panel>

      <Panel title="Line items">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-ink-500">
              <th className="font-medium py-2">Item</th>
              <th className="font-medium py-2">Warehouse</th>
              <th className="font-medium py-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {issue.items.map((line) => (
              <tr key={line.id} className="border-b border-stone-100 last:border-0">
                <td className="py-2 text-ink-900">{line.item.itemCode} — {line.item.name}</td>
                <td className="py-2 text-ink-700">{line.warehouse?.name}</td>
                <td className="py-2 text-right tabular-nums">{line.quantity} {line.item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {confirming && (
        <ConfirmDialog
          title={confirming === 'approve' ? 'Approve issue' : 'Reject issue'}
          message={
            confirming === 'approve'
              ? `Approve ${issue.issueNumber}? This will deduct the listed quantities from stock immediately.`
              : `Reject ${issue.issueNumber}? No stock will be affected.`
          }
          confirmLabel={confirming === 'approve' ? 'Approve' : 'Reject'}
          tone={confirming === 'approve' ? 'default' : 'danger'}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={decide}
        />
      )}
    </div>
  );
}
