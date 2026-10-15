import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { getSugarcaneReceipt, crushSugarcaneReceipt } from '../api/sugarcane';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { errorMessage } from '../api/client';
import { formatDate, formatNumber } from '../utils/format';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField, { inputClass } from '../components/ui/FormField';
import StatusBadge from '../components/ui/StatusBadge';
import { LoadingState, ErrorState } from '../components/ui/States';

export default function SugarcaneReceiptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = can(user.role, 'manageSugarcane');

  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  const [crushing, setCrushing] = useState(false);

  const load = useCallback(() => {
    setError(null);
    getSugarcaneReceipt(id).then(setReceipt).catch((err) => setError(errorMessage(err)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!receipt) return <LoadingState label="Loading receipt…" />;

  const remaining = Number(receipt.netWeight) - Number(receipt.crushedQuantity);

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => navigate('/sugarcane')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Back to sugarcane
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">{receipt.vehicleNumber}</h1>
          <p className="text-sm text-ink-500 mt-0.5">{receipt.supplier.name}</p>
        </div>
        <StatusBadge status={receipt.status} />
      </div>

      {canManage && receipt.status !== 'CRUSHED' && (
        <Button onClick={() => setCrushing(true)}>Record crushing</Button>
      )}

      <Panel title="Weighment">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-500">Gross weight</dt>
          <dd className="text-ink-900 tabular-nums">{formatNumber(receipt.grossWeight)}</dd>
          <dt className="text-ink-500">Tare weight</dt>
          <dd className="text-ink-900 tabular-nums">{formatNumber(receipt.tareWeight)}</dd>
          <dt className="text-ink-500">Net weight</dt>
          <dd className="text-ink-900 tabular-nums">{formatNumber(receipt.netWeight)}</dd>
          <dt className="text-ink-500">Crushed so far</dt>
          <dd className="text-ink-900 tabular-nums">{formatNumber(receipt.crushedQuantity)}</dd>
          <dt className="text-ink-500">Remaining</dt>
          <dd className="text-ink-900 tabular-nums">{formatNumber(remaining)}</dd>
        </dl>
      </Panel>

      <Panel title="Delivery details">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-500">Item</dt>
          <dd className="text-ink-900">{receipt.item.itemCode} — {receipt.item.name}</dd>
          <dt className="text-ink-500">Warehouse</dt>
          <dd className="text-ink-900">{receipt.warehouse.name}</dd>
          <dt className="text-ink-500">Arrival date</dt>
          <dd className="text-ink-900">{formatDate(receipt.arrivalDate)}</dd>
          {receipt.quality && (
            <>
              <dt className="text-ink-500">Quality / grade</dt>
              <dd className="text-ink-900">{receipt.quality}</dd>
            </>
          )}
          {receipt.unloadingLocation && (
            <>
              <dt className="text-ink-500">Unloading location</dt>
              <dd className="text-ink-900">{receipt.unloadingLocation}</dd>
            </>
          )}
          {receipt.crushingDate && (
            <>
              <dt className="text-ink-500">Last crushed</dt>
              <dd className="text-ink-900">{formatDate(receipt.crushingDate)}</dd>
            </>
          )}
        </dl>
      </Panel>

      {crushing && (
        <CrushModal
          receipt={receipt}
          remaining={remaining}
          onClose={() => setCrushing(false)}
          onSaved={() => { setCrushing(false); load(); }}
        />
      )}
    </div>
  );
}

function CrushModal({ receipt, remaining, onClose, onSaved }) {
  const [quantity, setQuantity] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty <= 0) return toast.error('Enter a quantity greater than zero');
    if (qty > remaining) return toast.error(`Only ${formatNumber(remaining)} remaining on this receipt`);
    setBusy(true);
    try {
      await crushSugarcaneReceipt(receipt.id, { quantity: qty });
      toast.success('Crushing recorded — stock deducted');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Record crushing" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-700">{formatNumber(remaining)} remaining on this receipt.</p>
        <FormField label="Quantity to crush" required>
          <input
            type="number" min="0" max={remaining} step="any" autoFocus
            className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)}
          />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Recording…' : 'Record crushing'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
