// A control-room-style readout strip rather than a grid of identical shadowed
// cards: one continuous bordered row, divided by hairlines, each segment a big
// number over a small label. Scrolls horizontally on narrow viewports.
export default function KpiStrip({ items }) {
  return (
    <div className="bg-white border border-stone-200 rounded flex overflow-x-auto divide-x divide-stone-200">
      {items.map(({ label, value, tone }) => (
        <div key={label} className="px-5 py-4 min-w-[148px] flex-1">
          <p className={`font-display text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-rust-600' : tone === 'warning' ? 'text-clay-600' : 'text-ink-900'}`}>
            {value}
          </p>
          <p className="text-xs text-ink-500 mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}
