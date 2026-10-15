import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from './States';

/**
 * Generic data table used by every module list page.
 *
 * columns: [{ key, header, render?: (row) => node, className? }]
 * rows: array of row objects (each needs a stable `id` unless rowKey is given)
 * meta: { page, limit, total, totalPages } — pass null/undefined to hide pagination
 * toolbar: optional node rendered above the table (search box, filter selects, "Add" button)
 * onRowClick: optional (row) => void — when given, rows become clickable (view-detail pattern)
 */
export default function DataTable({
  columns,
  rows,
  rowKey = (row) => row.id,
  loading,
  error,
  onRetry,
  emptyMessage = 'No records found.',
  emptyHint,
  meta,
  onPageChange,
  toolbar,
  onRowClick,
}) {
  return (
    <div className="bg-white border border-stone-200 rounded">
      {toolbar && <div className="p-4 border-b border-stone-200 flex flex-wrap items-center gap-3">{toolbar}</div>}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState message={emptyMessage} hint={emptyHint} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-ink-500">
                {columns.map((col) => (
                  <th key={col.key} className={`font-medium px-4 py-2.5 whitespace-nowrap ${col.className || ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-stone-100 last:border-0 hover:bg-stone-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-2.5 text-ink-900 ${col.className || ''}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200 text-sm text-ink-500">
          <span>
            Page {meta.page} of {meta.totalPages} &middot; {meta.total} total
          </span>
          <div className="flex gap-1">
            <button
              disabled={meta.page <= 1}
              onClick={() => onPageChange(meta.page - 1)}
              className="p-1.5 rounded border border-stone-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange(meta.page + 1)}
              className="p-1.5 rounded border border-stone-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
