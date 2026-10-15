import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { getAdjustment, approveAdjustment, rejectAdjustment } from '../api/adjustments';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { errorMessage } from '../api/client';
import { formatDate, formatNumber, toSentenceCase } from '../utils/format';
import { SignedQuantity } from './Adjustments';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { LoadingState, ErrorState } from '../components/ui/States';

export default function AdjustmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canDecide = can(user.role, 'approveAdjustment');

  const [adjustment, setAdjustment] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null); // 'approve' | 'reject' | null
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getAdjustment(id).then(setAdjustment).catch((err) => setError(errorMessage(err)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!adjustment) return <LoadingState label="Loading adjustment…" />;

  const decide = async () => {
    setBusy(true);
    try {
      if (confirming === 'approve') {
        await approveAdjustment(id);
        toast.success('Adjustment approved — stock updated');
      } else {
        await rejectAdjustment(id);
        toast.success('Adjustment rejected');
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
      <button onClick={() => navigate('/adjustments')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Back to stock adjustments
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">{adjustment.adjustmentNumber}</h1>
          <p className="text-sm text-ink-500 mt-0.5">{adjustment.item.itemCode} — {adjustment.item.name} · {adjustment.warehouse.name}</p>
        </div>
        <StatusBadge status={adjustment.status} />
      </div>

      {canDecide && adjustment.status === 'PENDING' && (
        <div className="flex gap-2">
          <Button onClick={() => setConfirming('approve')}>Approve</Button>
          <Button variant="danger" onClick={() => setConfirming('reject')}>Reject</Button>
        </div>
      )}

      <Panel title="Count">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-500">System quantity</dt>
          <dd className="text-ink-900 tabular-nums">{formatNumber(adjustment.systemQuantity)}</dd>
          <dt className="text-ink-500">Physical quantity</dt>
          <dd className="text-ink-900 tabular-nums">{formatNumber(adjustment.physicalQuantity)}</dd>
          <dt className="text-ink-500">Difference</dt>
          <dd><SignedQuantity value={adjustment.difference} /></dd>
          <dt className="text-ink-500">Reason</dt>
          <dd className="text-ink-900">{toSentenceCase(adjustment.reason)}</dd>
        </dl>
      </Panel>

      <Panel title="Details">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-500">Requested by</dt>
          <dd className="text-ink-900">{adjustment.requester.name}</dd>
          <dt className="text-ink-500">Date</dt>
          <dd className="text-ink-900">{formatDate(adjustment.createdAt)}</dd>
          {adjustment.approver && (
            <>
              <dt className="text-ink-500">{adjustment.status === 'REJECTED' ? 'Rejected by' : 'Approved by'}</dt>
              <dd className="text-ink-900">{adjustment.approver.name}</dd>
            </>
          )}
          {adjustment.remarks && (
            <>
              <dt className="text-ink-500">Remarks</dt>
              <dd className="text-ink-900">{adjustment.remarks}</dd>
            </>
          )}
        </dl>
      </Panel>

      {confirming && (
        <ConfirmDialog
          title={confirming === 'approve' ? 'Approve adjustment' : 'Reject adjustment'}
          message={
            confirming === 'approve'
              ? Number(adjustment.difference) === 0
                ? `Approve ${adjustment.adjustmentNumber}? The count matches system stock, so no stock movement will be recorded.`
                : `Approve ${adjustment.adjustmentNumber}? This applies the ${Number(adjustment.difference) > 0 ? 'increase' : 'decrease'} to stock immediately.`
              : `Reject ${adjustment.adjustmentNumber}? No stock will be affected.`
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
