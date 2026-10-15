import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getDashboardSummary, getStockMovementSeries, getLowStock } from '../api/dashboard';
import Panel from '../components/ui/Panel';
import KpiStrip from '../components/ui/KpiStrip';
import StatusBadge from '../components/ui/StatusBadge';
import { LoadingState, ErrorState } from '../components/ui/States';
import { formatCurrency, formatNumber, formatMonth, formatDate } from '../utils/format';
import { errorMessage } from '../api/client';

const AXIS_STYLE = { fontSize: 12, fill: '#5c6b60' };

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [movementSeries, setMovementSeries] = useState(null);
  const [lowStock, setLowStock] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setSummary(null);
    setMovementSeries(null);
    setLowStock(null);
    Promise.all([getDashboardSummary(), getStockMovementSeries(30), getLowStock({ limit: 8 })])
      .then(([s, series, low]) => {
        setSummary(s);
        setMovementSeries(series);
        setLowStock(low);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!summary || !movementSeries || !lowStock) return <LoadingState label="Loading dashboard…" />;

  const { kpis, charts, recentActivity } = summary;

  const kpiItems = [
    { label: 'Inventory items', value: formatNumber(kpis.totalInventoryItems) },
    { label: 'Inventory value', value: formatCurrency(kpis.totalInventoryValue) },
    { label: 'Low stock', value: formatNumber(kpis.lowStockItems), tone: kpis.lowStockItems > 0 ? 'warning' : undefined },
    { label: 'Out of stock', value: formatNumber(kpis.outOfStockItems), tone: kpis.outOfStockItems > 0 ? 'danger' : undefined },
    { label: 'Pending purchase orders', value: formatNumber(kpis.pendingPurchaseOrders) },
    { label: "Today's receipts", value: formatNumber(kpis.todaysReceipts) },
    { label: "Today's issues", value: formatNumber(kpis.todaysIssues) },
    { label: 'Sugarcane stock', value: formatNumber(kpis.currentSugarcaneStock) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-500 mt-0.5">Factory-wide inventory at a glance.</p>
      </div>

      <KpiStrip items={kpiItems} />

      <Panel title="Stock movement — last 30 days">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={movementSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d7" vertical={false} />
            <XAxis
              dataKey="date"
              tick={AXIS_STYLE}
              tickFormatter={(d) => formatDate(d)}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis tick={AXIS_STYLE} width={40} />
            <Tooltip labelFormatter={(d) => formatDate(d)} formatter={(v) => formatNumber(v)} />
            <Line type="monotone" dataKey="stockIn" name="Stock in" stroke="#2f7d4f" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="stockOut" name="Stock out" stroke="#b3432b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Inventory value by category">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={charts.inventoryValueByCategory} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d7" horizontal={false} />
              <XAxis type="number" tick={AXIS_STYLE} tickFormatter={(v) => formatCurrency(v)} />
              <YAxis type="category" dataKey="category" tick={AXIS_STYLE} width={100} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="value" fill="#1f4d36" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top consumed materials — last 30 days">
          {charts.topConsumedMaterials.length === 0 ? (
            <p className="text-sm text-ink-500 py-10 text-center">No consumption recorded in the last 30 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.topConsumedMaterials} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d7" horizontal={false} />
                <XAxis type="number" tick={AXIS_STYLE} tickFormatter={(v) => formatNumber(v)} />
                <YAxis type="category" dataKey="name" tick={AXIS_STYLE} width={100} />
                <Tooltip formatter={(v) => formatNumber(v)} />
                <Bar dataKey="quantity" fill="#b8732e" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Monthly purchases">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.monthlyPurchases}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d7" vertical={false} />
              <XAxis dataKey="month" tick={AXIS_STYLE} tickFormatter={formatMonth} />
              <YAxis tick={AXIS_STYLE} width={56} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip labelFormatter={formatMonth} formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="totalAmount" fill="#1f4d36" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Monthly consumption">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={charts.monthlyConsumption}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e0d7" vertical={false} />
              <XAxis dataKey="month" tick={AXIS_STYLE} tickFormatter={formatMonth} />
              <YAxis tick={AXIS_STYLE} width={48} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip labelFormatter={formatMonth} formatter={(v) => formatNumber(v)} />
              <Bar dataKey="totalQuantity" fill="#b8732e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Low stock">
        {lowStock.items.length === 0 ? (
          <p className="text-sm text-ink-500 py-10 text-center">Nothing below reorder level right now.</p>
        ) : (
          <div className="overflow-x-auto -m-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-ink-500">
                  <th className="font-medium px-5 py-2.5">Item</th>
                  <th className="font-medium px-5 py-2.5">Category</th>
                  <th className="font-medium px-5 py-2.5">Stock</th>
                  <th className="font-medium px-5 py-2.5">Reorder level</th>
                  <th className="font-medium px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.items.map((item) => (
                  <tr key={item.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-5 py-2.5 text-ink-900">{item.name}</td>
                    <td className="px-5 py-2.5 text-ink-700">{item.category?.name}</td>
                    <td className="px-5 py-2.5 text-ink-900 tabular-nums">{formatNumber(item.totalStock)} {item.unit}</td>
                    <td className="px-5 py-2.5 text-ink-500 tabular-nums">{formatNumber(item.reorderLevel)}</td>
                    <td className="px-5 py-2.5"><StatusBadge status={item.stockStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Recent purchases">
          <ActivityList
            rows={recentActivity.purchases}
            empty="No purchase orders yet."
            render={(po) => (
              <>
                <div>
                  <p className="text-ink-900">{po.poNumber}</p>
                  <p className="text-xs text-ink-500">{po.supplier.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-ink-900 tabular-nums">{formatCurrency(po.totalAmount)}</p>
                  <StatusBadge status={po.status} />
                </div>
              </>
            )}
          />
        </Panel>

        <Panel title="Recent receipts">
          <ActivityList
            rows={recentActivity.receipts}
            empty="No goods receipts yet."
            render={(r) => (
              <>
                <div>
                  <p className="text-ink-900">{r.receiptNumber}</p>
                  <p className="text-xs text-ink-500">{r.warehouse.name}</p>
                </div>
                <p className="text-xs text-ink-500">{formatDate(r.receivedAt)}</p>
              </>
            )}
          />
        </Panel>

        <Panel title="Recent issues">
          <ActivityList
            rows={recentActivity.issues}
            empty="No stock issues yet."
            render={(i) => (
              <>
                <div>
                  <p className="text-ink-900">{i.issueNumber}</p>
                  <p className="text-xs text-ink-500">{i.department}</p>
                </div>
                <StatusBadge status={i.status} />
              </>
            )}
          />
        </Panel>

        <Panel title="Recent adjustments">
          <ActivityList
            rows={recentActivity.adjustments}
            empty="No stock adjustments yet."
            render={(a) => (
              <>
                <div>
                  <p className="text-ink-900">{a.adjustmentNumber}</p>
                  <p className="text-xs text-ink-500">{a.item.name}</p>
                </div>
                <StatusBadge status={a.status} />
              </>
            )}
          />
        </Panel>
      </div>
    </div>
  );
}

function ActivityList({ rows, render, empty }) {
  if (rows.length === 0) return <p className="text-sm text-ink-500 text-center py-6">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between text-sm">
          {render(row)}
        </li>
      ))}
    </ul>
  );
}
