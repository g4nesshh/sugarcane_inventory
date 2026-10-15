import { Trash2, Plus } from 'lucide-react';

const cellInput = 'w-full rounded border border-stone-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cane-500 focus:border-cane-500';

/**
 * Generic editable line-item table for multi-line forms (PO lines, receipt
 * lines, issue lines, transfer lines, consumption lines). The parent owns the
 * row data and all mutation logic (including any auto-fill side effects, e.g.
 * selecting an item pre-filling its unit cost) via onRowChange.
 *
 * columns: [{ key, header, type: 'select'|'number'|'text'|'date'|'readonly', options?, numeric?, placeholder?, width? }]
 * rows: array of plain row objects
 * lineTotal?: (row) => number — if given, adds a read-only "Line total" column
 * onAddRow/onRemoveRow: omit either to use this for a fixed set of rows (e.g. a
 * goods receipt's lines are fixed to a PO's content — removable, not freely addable)
 */
export default function LineItemsTable({ columns, rows, onRowChange, onAddRow, onRemoveRow, addLabel = 'Add line', lineTotal }) {
  return (
    <div className="border border-stone-200 rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200 text-left text-ink-500">
            {columns.map((col) => (
              <th key={col.key} className="font-medium px-3 py-2" style={col.width ? { width: col.width } : undefined}>
                {col.header}
              </th>
            ))}
            {lineTotal && <th className="font-medium px-3 py-2 text-right">Line total</th>}
            {onRemoveRow && <th className="w-9" />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (lineTotal ? 1 : 0) + (onRemoveRow ? 1 : 0)} className="text-center text-sm text-ink-500 py-6">
                No lines yet.
              </td>
            </tr>
          )}
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-stone-100 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2">
                  {col.type === 'readonly' ? (
                    <span className="text-sm text-ink-900">{row[col.key]}</span>
                  ) : col.type === 'select' ? (
                    <select
                      className={cellInput}
                      value={row[col.key] ?? ''}
                      onChange={(e) => onRowChange(idx, col.key, col.numeric ? Number(e.target.value) : e.target.value)}
                    >
                      <option value="" disabled>{col.placeholder || 'Select…'}</option>
                      {col.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : col.type === 'number' ? (
                    <input
                      type="number" min="0" step="any" className={cellInput}
                      value={row[col.key] ?? ''}
                      onChange={(e) => onRowChange(idx, col.key, e.target.value)}
                      placeholder={col.placeholder}
                    />
                  ) : col.type === 'date' ? (
                    <input
                      type="date" className={cellInput}
                      value={row[col.key] ?? ''}
                      onChange={(e) => onRowChange(idx, col.key, e.target.value)}
                    />
                  ) : (
                    <input
                      type="text" className={cellInput}
                      value={row[col.key] ?? ''}
                      onChange={(e) => onRowChange(idx, col.key, e.target.value)}
                      placeholder={col.placeholder}
                    />
                  )}
                </td>
              ))}
              {lineTotal && (
                <td className="px-3 py-2 text-right tabular-nums text-ink-900">{lineTotal(row)}</td>
              )}
              {onRemoveRow && (
                <td className="px-2 text-center">
                  <button type="button" onClick={() => onRemoveRow(idx)} className="p-1 rounded text-ink-500 hover:text-rust-600 hover:bg-stone-100">
                    <Trash2 size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {onAddRow && (
        <button
          type="button"
          onClick={onAddRow}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-cane-600 hover:bg-cane-50 border-t border-stone-200"
        >
          <Plus size={14} /> {addLabel}
        </button>
      )}
    </div>
  );
}
