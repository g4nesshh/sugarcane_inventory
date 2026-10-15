import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { createStockIssue } from '../api/stockIssues';
import { listItems } from '../api/items';
import { listWarehouses } from '../api/warehouses';
import { errorMessage } from '../api/client';
import { DEPARTMENT_OPTIONS } from '../config/options';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import FormField, { inputClass } from '../components/ui/FormField';
import LineItemsTable from '../components/ui/LineItemsTable';
import { LoadingState } from '../components/ui/States';

const emptyLine = () => ({ itemId: '', warehouseId: '', quantity: '' });

export default function StockIssueForm() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [warehouses, setWarehouses] = useState(null);

  useEffect(() => {
    Promise.all([listItems({ status: 'ACTIVE', limit: 200 }), listWarehouses({ status: 'ACTIVE', limit: 100 })]).then(
      ([i, w]) => {
        setItems(i.items);
        setWarehouses(w.warehouses);
      }
    );
  }, []);

  const [department, setDepartment] = useState('');
  const [purpose, setPurpose] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [busy, setBusy] = useState(false);

  if (!items || !warehouses) return <LoadingState label="Loading…" />;

  const updateLine = (idx, key, value) =>
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, [key]: value } : line)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const validLines = lines.filter((l) => l.itemId && l.warehouseId && l.quantity);

  const submit = async (e) => {
    e.preventDefault();
    if (!department) return toast.error('Select a department');
    if (validLines.length === 0) return toast.error('Add at least one line item');

    setBusy(true);
    try {
      const issue = await createStockIssue({
        department,
        purpose: purpose || undefined,
        remarks: remarks || undefined,
        items: validLines.map((l) => ({
          itemId: Number(l.itemId),
          warehouseId: Number(l.warehouseId),
          quantity: Number(l.quantity),
        })),
      });
      toast.success(`${issue.issueNumber} created, pending approval`);
      navigate(`/issues/${issue.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <button onClick={() => navigate('/issues')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft size={15} /> Back to stock issues
      </button>

      <h1 className="font-display text-xl font-semibold text-ink-900">New stock issue</h1>

      <form onSubmit={submit} className="space-y-5">
        <Panel title="Details">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Department" required>
              <select className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)} required>
                <option value="" disabled>Select a department</option>
                {DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Purpose">
              <input className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={300} />
            </FormField>
          </div>
          <div className="mt-4">
            <FormField label="Remarks">
              <textarea className={inputClass} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={1000} />
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
              {
                key: 'warehouseId', header: 'Warehouse', type: 'select', width: '26%', placeholder: 'Select warehouse',
                options: warehouses.map((w) => ({ value: w.id, label: w.name })),
              },
              { key: 'quantity', header: 'Quantity', type: 'number', width: '20%' },
            ]}
            rows={lines}
            onRowChange={updateLine}
            onAddRow={addLine}
            onRemoveRow={removeLine}
            addLabel="Add line item"
          />
          <p className="text-xs text-ink-500 mt-3">
            Stock isn't deducted until this request is approved — availability is checked at approval time, not now.
          </p>
        </Panel>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/issues')} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </div>
      </form>
    </div>
  );
}
