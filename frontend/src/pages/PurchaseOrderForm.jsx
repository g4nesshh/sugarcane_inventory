import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { createPurchaseOrder } from '../api/purchaseOrders';
import { listSuppliers } from '../api/suppliers';
import { listItems } from '../api/items';
import { errorMessage } from '../api/client';
import { formatCurrency } from '../utils/format';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import FormField, { inputClass } from '../components/ui/FormField';
import LineItemsTable from '../components/ui/LineItemsTable';
import { LoadingState } from '../components/ui/States';

const emptyLine = () => ({ itemId: '', orderedQuantity: '', unitPrice: '' });

export default function PurchaseOrderForm() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState(null);
  const [items, setItems] = useState(null);

  useEffect(() => {
    Promise.all([
      listSuppliers({ status: 'ACTIVE', limit: 100 }),
      listItems({ status: 'ACTIVE', limit: 200 }),
    ]).then(([s, i]) => {
      setSuppliers(s.suppliers);
      setItems(i.items);
    });
  }, []);

  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [tax, setTax] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [busy, setBusy] = useState(false);

  if (!suppliers || !items) return <LoadingState label="Loading…" />;

  const itemById = Object.fromEntries(items.map((i) => [i.id, i]));

  const updateLine = (idx, key, value) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line;
        const next = { ...line, [key]: value };
        // Selecting an item pre-fills its current unit cost as a helpful default.
        if (key === 'itemId') next.unitPrice = String(itemById[value]?.unitCost ?? '');
        return next;
      })
    );
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const validLines = lines.filter((l) => l.itemId && l.orderedQuantity && l.unitPrice !== '');
  const subtotal = validLines.reduce((sum, l) => sum + Number(l.orderedQuantity) * Number(l.unitPrice), 0);
  const total = subtotal + (Number(tax) || 0) - (Number(discount) || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!supplierId) return toast.error('Select a supplier');
    if (validLines.length === 0) return toast.error('Add at least one line item');

    setBusy(true);
    try {
      const po = await createPurchaseOrder({
        supplierId: Number(supplierId),
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
      toast.success(`${po.poNumber} created`);
      navigate(`/purchases/${po.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => navigate('/purchases')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Back to purchase orders
      </button>

      <h1 className="font-display text-xl font-semibold text-ink-900">New purchase order</h1>

      <form onSubmit={submit} className="space-y-5">
        <Panel title="Details">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Supplier" required>
              <select className={inputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                <option value="" disabled>Select a supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </FormField>
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

          <div className="mt-4 flex justify-end">
            <div className="w-56 space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-500">
                <span>Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Tax</span><span className="tabular-nums">+{formatCurrency(Number(tax) || 0)}</span>
              </div>
              <div className="flex justify-between text-ink-500">
                <span>Discount</span><span className="tabular-nums">−{formatCurrency(Number(discount) || 0)}</span>
              </div>
              <div className="flex justify-between font-semibold text-ink-900 pt-1.5 border-t border-stone-200">
                <span>Total</span><span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </Panel>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/purchases')} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create purchase order (Draft)'}
          </Button>
        </div>
      </form>
    </div>
  );
}
