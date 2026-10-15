import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getStockTransfer, approveStockTransfer, rejectStockTransfer } from '../api/stockTransfers';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { errorMessage } from '../api/client';
import { formatDate } from '../utils/format';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { LoadingState, ErrorState } from '../components/ui/States';

export default function StockTransferDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canDecide = can(user.role, 'approveIssueOrTransfer');

  const [transfer, setTransfer] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null); // 'approve' | 'reject' | null
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getStockTransfer(id).then(setTransfer).catch((err) => setError(errorMessage(err)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!transfer) return <LoadingState label="Loading stock transfer…" />;

  const decide = async () => {
    setBusy(true);
    try {
      if (confirming === 'approve') {
        await approveStockTransfer(id);
        toast.success('Transfer completed — stock moved');
      } else {
        await rejectStockTransfer(id);
        toast.success('Transfer rejected');
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
      <button onClick={() => navigate('/transfers')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Back to stock transfers
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">{transfer.transferNumber}</h1>
          <p className="text-sm text-ink-500 mt-0.5 flex items-center gap-1.5">
            {transfer.source.name} <ArrowRight size={13} /> {transfer.destination.name}
          </p>
        </div>
        <StatusBadge status={transfer.status} />
      </div>

      {canDecide && transfer.status === 'PENDING' && (
        <div className="flex gap-2">
          <Button onClick={() => setConfirming('approve')}>Approve</Button>
          <Button variant="danger" onClick={() => setConfirming('reject')}>Reject</Button>
        </div>
      )}

      <Panel title="Details">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-500">Source</dt>
          <dd className="text-ink-900">{transfer.source.name}</dd>
          <dt className="text-ink-500">Destination</dt>
          <dd className="text-ink-900">{transfer.destination.name}</dd>
          <dt className="text-ink-500">Date</dt>
          <dd className="text-ink-900">{formatDate(transfer.createdAt)}</dd>
        </dl>
      </Panel>

      <Panel title="Line items">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-ink-500">
              <th className="font-medium py-2">Item</th>
              <th className="font-medium py-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {transfer.items.map((line) => (
              <tr key={line.id} className="border-b border-stone-100 last:border-0">
                <td className="py-2 text-ink-900">{line.item.itemCode} — {line.item.name}</td>
                <td className="py-2 text-right tabular-nums">{line.quantity} {line.item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {confirming && (
        <ConfirmDialog
          title={confirming === 'approve' ? 'Approve transfer' : 'Reject transfer'}
          message={
            confirming === 'approve'
              ? `Approve ${transfer.transferNumber}? This moves the listed quantities from ${transfer.source.name} to ${transfer.destination.name} immediately — if any line can't be covered by the source warehouse's stock, the whole transfer is rejected.`
              : `Reject ${transfer.transferNumber}? No stock will be affected.`
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
