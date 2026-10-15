import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { listSugarcaneReceipts, createSugarcaneReceipt } from '../api/sugarcane';
import { listSuppliers } from '../api/suppliers';
import { listItems } from '../api/items';
import { listWarehouses } from '../api/warehouses';
import { useListPage } from '../hooks/useListPage';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { CANE_STATUS_OPTIONS } from '../config/options';
import { errorMessage } from '../api/client';
import { formatDate, formatNumber } from '../utils/format';
import { inputClass } from '../components/ui/FormField';
import DataTable from '../components/ui/DataTable';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';
import StatusBadge from '../components/ui/StatusBadge';
import { LoadingState } from '../components/ui/States';

export default function Sugarcane() {
  const { user } = useAuth();
  const canManage = can(user.role, 'manageSugarcane');
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => { listSuppliers({ status: 'ACTIVE', limit: 100 }).then((d) => setSuppliers(d.suppliers)).catch(() => {}); }, []);

  const [supplierId, setSupplierId] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading, error, page, setPage, reload } = useListPage(listSugarcaneReceipts, {
    supplierId, status, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  });

  const [adding, setAdding] = useState(false);

  const columns = [
    { key: 'arrivalDate', header: 'Arrival', render: (r) => formatDate(r.arrivalDate) },
    { key: 'vehicleNumber', header: 'Vehicle' },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier.name },
    { key: 'grossWeight', header: 'Gross', className: 'text-right', render: (r) => formatNumber(r.grossWeight) },
    { key: 'tareWeight', header: 'Tare', className: 'text-right', render: (r) => formatNumber(r.tareWeight) },
    { key: 'netWeight', header: 'Net', className: 'text-right', render: (r) => formatNumber(r.netWeight) },
    { key: 'crushedQuantity', header: 'Crushed', className: 'text-right', render: (r) => formatNumber(r.crushedQuantity) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">Sugarcane</h1>
          <p className="text-sm text-ink-500 mt-0.5">Gate deliveries, weighment, and crushing.</p>
        </div>
        {canManage && (
          <Button icon={Plus} onClick={() => setAdding(true)}>
            Record receipt
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.receipts || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No sugarcane receipts found."
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/sugarcane/${row.id}`)}
        toolbar={
          <>
            <Select
              value={supplierId}
              onChange={setSupplierId}
              placeholder="All suppliers"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Select value={status} onChange={setStatus} placeholder="All statuses" options={CANE_STATUS_OPTIONS} />
            <div className="flex items-center gap-1.5 text-sm text-ink-500">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputClass} mt-0 w-36`} />
              <span>to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputClass} mt-0 w-36`} />
            </div>
          </>
        }
      />

      {adding && (
        <ReceiptFormModal
          suppliers={suppliers}
          onClose={() => setAdding(false)}
          onSaved={(receipt) => { setAdding(false); navigate(`/sugarcane/${receipt.id}`); }}
        />
      )}
    </div>
  );
}

function ReceiptFormModal({ suppliers, onClose, onSaved }) {
  const [items, setItems] = useState(null);
  const [warehouses, setWarehouses] = useState(null);
  useEffect(() => {
    Promise.all([listItems({ status: 'ACTIVE', limit: 200 }), listWarehouses({ status: 'ACTIVE', limit: 100 })]).then(([i, w]) => {
      setItems(i.items);
      setWarehouses(w.warehouses);
    });
  }, []);

  const [form, setForm] = useState({
    supplierId: '', itemId: '', warehouseId: '', vehicleNumber: '',
    grossWeight: '', tareWeight: '', quality: '', unloadingLocation: '',
    arrivalDate: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const netWeight = Number(form.grossWeight || 0) - Number(form.tareWeight || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (netWeight <= 0) return toast.error('Gross weight must be greater than tare weight');
    setBusy(true);
    try {
      const receipt = await createSugarcaneReceipt({
        supplierId: Number(form.supplierId),
        itemId: Number(form.itemId),
        warehouseId: Number(form.warehouseId),
        vehicleNumber: form.vehicleNumber,
        grossWeight: Number(form.grossWeight),
        tareWeight: Number(form.tareWeight),
        quality: form.quality || undefined,
        unloadingLocation: form.unloadingLocation || undefined,
        arrivalDate: form.arrivalDate,
      });
      toast.success('Receipt recorded — stock increased');
      onSaved(receipt);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!items || !warehouses) return <Modal title="Record sugarcane receipt" onClose={onClose}><LoadingState /></Modal>;

  return (
    <Modal title="Record sugarcane receipt" onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <FormField label="Supplier" required>
          <select className={inputClass} value={form.supplierId} onChange={set('supplierId')} required>
            <option value="" disabled>Select supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Item" required>
            <select className={inputClass} value={form.itemId} onChange={set('itemId')} required>
              <option value="" disabled>Select item</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.name}</option>)}
            </select>
          </FormField>
          <FormField label="Warehouse" required>
            <select className={inputClass} value={form.warehouseId} onChange={set('warehouseId')} required>
              <option value="" disabled>Select warehouse</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Vehicle number" required>
          <input className={inputClass} value={form.vehicleNumber} onChange={set('vehicleNumber')} required maxLength={30} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Gross weight" required>
            <input type="number" min="0" step="any" className={inputClass} value={form.grossWeight} onChange={set('grossWeight')} required />
          </FormField>
          <FormField label="Tare weight" required>
            <input type="number" min="0" step="any" className={inputClass} value={form.tareWeight} onChange={set('tareWeight')} required />
          </FormField>
        </div>
        <p className="text-xs text-ink-500 -mt-2">Net weight: {formatNumber(netWeight)}</p>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Quality / grade">
            <input className={inputClass} value={form.quality} onChange={set('quality')} maxLength={50} />
          </FormField>
          <FormField label="Arrival date">
            <input type="date" className={inputClass} value={form.arrivalDate} onChange={set('arrivalDate')} />
          </FormField>
        </div>
        <FormField label="Unloading location">
          <input className={inputClass} value={form.unloadingLocation} onChange={set('unloadingLocation')} maxLength={100} />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Record receipt'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
