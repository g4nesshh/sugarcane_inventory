import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Pencil, PackageCheck } from 'lucide-react';
import { getPurchaseOrder, updatePurchaseOrder } from '../api/purchaseOrders';
import { listItems } from '../api/items';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { errorMessage } from '../api/client';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import FormField, { inputClass } from '../components/ui/FormField';
import LineItemsTable from '../components/ui/LineItemsTable';
import StatusBadge from '../components/ui/StatusBadge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { LoadingState, ErrorState } from '../components/ui/States';

// Mirrors backend/src/services/purchaseOrder.service.js TRANSITIONS exactly.
const TRANSITIONS = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'CANCELLED', 'DRAFT'],
  APPROVED: ['CANCELLED'],
  PARTIALLY_RECEIVED: [],
  RECEIVED: [],
  CANCELLED: [],
};
const TRANSITION_LABEL = {
  PENDING: 'Submit for approval',
  APPROVED: 'Approve',
  CANCELLED: 'Cancel',
  DRAFT: 'Revert to draft',
};

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = can(user.role, 'managePurchases');
  const canReceive = can(user.role, 'receiveStock');

  const [po, setPo] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(null);

  const load = useCallback(() => {
    setError(null);
    getPurchaseOrder(id).then(setPo).catch((err) => setError(errorMessage(err)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!po) return <LoadingState label="Loading purchase order…" />;

  const transitionTo = async (status) => {
    try {
      await updatePurchaseOrder(id, { status });
      toast.success(`Marked ${status.toLowerCase().replace('_', ' ')}`);
      setConfirmingStatus(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => navigate('/purchases')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Back to purchase orders
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">{po.poNumber}</h1>
          <p className="text-sm text-ink-500 mt-0.5">{po.supplier.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={po.status} />
          {canManage && po.status === 'DRAFT' && !editing && (
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {canReceive && ['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status) && (
            <Button icon={PackageCheck} onClick={() => navigate(`/receipts/new?poId=${po.id}`)}>
              Receive goods
            </Button>
          )}
        </div>
      </div>

      {canManage && !editing && TRANSITIONS[po.status].length > 0 && (
        <div className="flex gap-2">
          {TRANSITIONS[po.status].map((status) => (
            <Button
              key={status}
              variant={status === 'CANCELLED' ? 'danger' : status === 'DRAFT' ? 'secondary' : 'primary'}
              onClick={() => setConfirmingStatus(status)}
            >
              {TRANSITION_LABEL[status]}
            </Button>
          ))}
        </div>
      )}

      {editing ? (
        <EditForm po={po} items={null} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
      ) : (
        <ViewMode po={po} />
      )}

      {confirmingStatus && (
        <ConfirmDialog
          title={TRANSITION_LABEL[confirmingStatus]}
          message={`${TRANSITION_LABEL[confirmingStatus]} ${po.poNumber}?${
            confirmingStatus === 'CANCELLED' ? ' This cannot be undone.' : ''
          }`}
          confirmLabel={TRANSITION_LABEL[confirmingStatus]}
          tone={confirmingStatus === 'CANCELLED' ? 'danger' : 'default'}
          onCancel={() => setConfirmingStatus(null)}
          onConfirm={() => transitionTo(confirmingStatus)}
        />
      )}
    </div>
  );
}

function ViewMode({ po }) {
  return (
    <>
      <Panel title="Details">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-ink-500">Order date</dt>
          <dd className="text-ink-900">{formatDate(po.orderDate)}</dd>
          <dt className="text-ink-500">Expected delivery</dt>
          <dd className="text-ink-900">{po.expectedDate ? formatDate(po.expectedDate) : '—'}</dd>
          <dt className="text-ink-500">Created by</dt>
          <dd className="text-ink-900">{po.creator.name}</dd>
          {po.notes && (
            <>
              <dt className="text-ink-500">Notes</dt>
              <dd className="text-ink-900">{po.notes}</dd>
            </>
          )}
        </dl>
      </Panel>

      <Panel title="Line items">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-ink-500">
              <th className="font-medium py-2">Item</th>
              <th className="font-medium py-2 text-right">Ordered</th>
              <th className="font-medium py-2 text-right">Received</th>
              <th className="font-medium py-2 text-right">Unit price</th>
              <th className="font-medium py-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((line) => (
              <tr key={line.id} className="border-b border-stone-100 last:border-0">
                <td className="py-2 text-ink-900">{line.item.itemCode} — {line.item.name}</td>
                <td className="py-2 text-right tabular-nums">{line.orderedQuantity} {line.item.unit}</td>
                <td className="py-2 text-right tabular-nums text-ink-500">{line.receivedQuantity} {line.item.unit}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(line.unitPrice)}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(line.orderedQuantity * line.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end">
          <div className="w-56 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-500"><span>Tax</span><span className="tabular-nums">+{formatCurrency(po.tax)}</span></div>
            <div className="flex justify-between text-ink-500"><span>Discount</span><span className="tabular-nums">−{formatCurrency(po.discount)}</span></div>
            <div className="flex justify-between font-semibold text-ink-900 pt-1.5 border-t border-stone-200">
              <span>Total</span><span className="tabular-nums">{formatCurrency(po.totalAmount)}</span>
            </div>
          </div>
        </div>
      </Panel>

      {po.receipts?.length > 0 && (
        <Panel title="Goods receipts against this order">
          <ul className="space-y-2 text-sm">
            {po.receipts.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span className="text-ink-900">{r.receiptNumber}</span>
                <span className="text-ink-500">{formatDateTime(r.receivedAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function EditForm({ po, onCancel, onSaved }) {
  const [items, setItems] = useState(null);
  useEffect(() => { listItems({ status: 'ACTIVE', limit: 200 }).then((d) => setItems(d.items)); }, []);

  const [expectedDate, setExpectedDate] = useState(po.expectedDate ? po.expectedDate.slice(0, 10) : '');
  const [tax, setTax] = useState(String(po.tax));
  const [discount, setDiscount] = useState(String(po.discount));
  const [notes, setNotes] = useState(po.notes || '');
  const [lines, setLines] = useState(
    po.items.map((l) => ({ itemId: l.item.id, orderedQuantity: String(l.orderedQuantity), unitPrice: String(l.unitPrice) }))
  );
  const [busy, setBusy] = useState(false);

  if (!items) return <LoadingState />;
  const itemById = Object.fromEntries(items.map((i) => [i.id, i]));

  const updateLine = (idx, key, value) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line;
        const next = { ...line, [key]: value };
        if (key === 'itemId') next.unitPrice = String(itemById[value]?.unitCost ?? '');
        return next;
      })
    );
  };
  const addLine = () => setLines((prev) => [...prev, { itemId: '', orderedQuantity: '', unitPrice: '' }]);
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const validLines = lines.filter((l) => l.itemId && l.orderedQuantity && l.unitPrice !== '');

  const submit = async (e) => {
    e.preventDefault();
    if (validLines.length === 0) return toast.error('Add at least one line item');
    setBusy(true);
    try {
      await updatePurchaseOrder(po.id, {
        expectedDate: expectedDate || undefined,
        tax: Number(tax) || 0,
        discount: Number(discount) || 0,
        notes: notes || undefined,
        items: validLines.map((l) => ({
          itemId: Number(l.itemId),
          orderedQuantity: Number(l.orderedQuantity),
          unitPrice: Number(l.unitPrice),
        })),
      });
      toast.success('Purchase order updated');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Panel title="Details">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Expected delivery date">
            <input type="date" className={inputClass} value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </FormField>
          <FormField label="Tax">
            <input type="number" min="0" step="any" className={inputClass} value={tax} onChange={(e) => setTax(e.target.value)} />
          </FormField>
          <FormField label="Discount">
            <input type="number" min="0" step="any" className={inputClass} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </FormField>
        </div>
        <div className="mt-4">
          <FormField label="Notes">
            <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </FormField>
        </div>
      </Panel>

      <Panel title="Line items">
        <LineItemsTable
          columns={[
            {
              key: 'itemId', header: 'Item', type: 'select', width: '34%', placeholder: 'Select item',
              options: items.map((i) => ({ value: i.id, label: `${i.itemCode} — ${i.name}` })),
            },
            { key: 'orderedQuantity', header: 'Quantity', type: 'number', width: '20%' },
            { key: 'unitPrice', header: 'Unit price', type: 'number', width: '20%' },
          ]}
          rows={lines}
          onRowChange={updateLine}
          onAddRow={addLine}
          onRemoveRow={removeLine}
          addLabel="Add line item"
          lineTotal={(row) =>
            row.orderedQuantity && row.unitPrice !== '' ? formatCurrency(Number(row.orderedQuantity) * Number(row.unitPrice)) : '—'
          }
        />
      </Panel>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
