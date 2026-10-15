import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { listGoodsReceipts, getGoodsReceipt } from '../api/goodsReceipts';
import { listPurchaseOrders } from '../api/purchaseOrders';
import { listWarehouses } from '../api/warehouses';
import { useListPage } from '../hooks/useListPage';
import { useAuth } from '../context/AuthContext';
import { can } from '../config/permissions';
import { formatDateTime } from '../utils/format';
import { errorMessage } from '../api/client';
import { inputClass } from '../components/ui/FormField';
import DataTable from '../components/ui/DataTable';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { LoadingState, ErrorState } from '../components/ui/States';

export default function GoodsReceipts() {
  const { user } = useAuth();
  const canReceive = can(user.role, 'receiveStock');
  const navigate = useNavigate();

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    listPurchaseOrders({ limit: 100 }).then((d) => setPurchaseOrders(d.purchaseOrders)).catch(() => {});
    listWarehouses({ limit: 100 }).then((d) => setWarehouses(d.warehouses)).catch(() => {});
  }, []);

  const [purchaseOrderId, setPurchaseOrderId] = useState(undefined);
  const [warehouseId, setWarehouseId] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, loading, error, page, setPage, reload } = useListPage(listGoodsReceipts, {
    purchaseOrderId, warehouseId, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  });

  const [viewingId, setViewingId] = useState(null);

  const columns = [
    { key: 'receiptNumber', header: 'Receipt number' },
    { key: 'poNumber', header: 'Purchase order', render: (r) => r.purchaseOrder.poNumber },
    { key: 'supplier', header: 'Supplier', render: (r) => r.purchaseOrder.supplier.name },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouse.name },
    { key: 'receivedAt', header: 'Received', render: (r) => formatDateTime(r.receivedAt) },
    { key: 'receiver', header: 'Received by', render: (r) => r.receiver.name },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-900">Goods receipts</h1>
          <p className="text-sm text-ink-500 mt-0.5">Materials received against purchase orders.</p>
        </div>
        {canReceive && (
          <Button icon={Plus} onClick={() => navigate('/receipts/new')}>
            Receive goods
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data?.receipts || []}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyMessage="No goods receipts found."
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => setViewingId(row.id)}
        toolbar={
          <>
            {purchaseOrders.length > 0 && (
              <Select
                value={purchaseOrderId}
                onChange={setPurchaseOrderId}
                placeholder="All purchase orders"
                options={purchaseOrders.map((po) => ({ value: po.id, label: po.poNumber }))}
              />
            )}
            <Select
              value={warehouseId}
              onChange={setWarehouseId}
              placeholder="All warehouses"
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
            <div className="flex items-center gap-1.5 text-sm text-ink-500">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${inputClass} mt-0 w-36`} />
              <span>to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${inputClass} mt-0 w-36`} />
            </div>
          </>
        }
      />

      {viewingId && <ReceiptDetailModal id={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
}

function ReceiptDetailModal({ id, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getGoodsReceipt(id).then(setReceipt).catch((err) => setError(errorMessage(err)));
  }, [id]);

  return (
    <Modal title={receipt ? receipt.receiptNumber : 'Goods receipt'} onClose={onClose} width="max-w-lg">
      {error ? (
        <ErrorState message={error} />
      ) : !receipt ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-500">Purchase order</dt>
            <dd className="text-ink-900">{receipt.purchaseOrder.poNumber}</dd>
            <dt className="text-ink-500">Supplier</dt>
            <dd className="text-ink-900">{receipt.purchaseOrder.supplier.name}</dd>
            <dt className="text-ink-500">Warehouse</dt>
            <dd className="text-ink-900">{receipt.warehouse.name}</dd>
            <dt className="text-ink-500">Received by</dt>
            <dd className="text-ink-900">{receipt.receiver.name}</dd>
            <dt className="text-ink-500">Received at</dt>
            <dd className="text-ink-900">{formatDateTime(receipt.receivedAt)}</dd>
          </dl>
          <table className="w-full text-sm border-t border-stone-200 pt-2">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="font-medium py-2">Item</th>
                <th className="font-medium py-2 text-right">Quantity</th>
                <th className="font-medium py-2">Batch</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((line) => (
                <tr key={line.id} className="border-t border-stone-100">
                  <td className="py-2 text-ink-900">{line.item.itemCode} — {line.item.name}</td>
                  <td className="py-2 text-right tabular-nums">{line.quantity} {line.item.unit}</td>
                  <td className="py-2 text-ink-500">{line.batchNumber || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
