import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-500 text-sm">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertTriangle size={22} className="text-rust-500" strokeWidth={1.75} />
      <p className="text-sm text-ink-700 max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm text-cane-600 hover:text-cane-700 font-medium underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message = 'Nothing here yet.', hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Inbox size={22} className="text-stone-400" strokeWidth={1.75} />
      <p className="text-sm text-ink-700">{message}</p>
      {hint && <p className="text-xs text-ink-500 max-w-xs">{hint}</p>}
    </div>
  );
}
