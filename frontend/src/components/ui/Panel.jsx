export default function Panel({ title, action, children, className = '' }) {
  return (
    <div className={`bg-white border border-stone-200 rounded ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200">
          {title && <h3 className="font-display font-semibold text-sm text-ink-900">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
