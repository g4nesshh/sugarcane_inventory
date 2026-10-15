import { toSentenceCase } from '../../utils/format';

const BUCKETS = {
  success: 'bg-moss-500/10 text-moss-600 border-moss-500/25',
  warning: 'bg-clay-400/15 text-clay-600 border-clay-400/35',
  danger: 'bg-rust-500/10 text-rust-600 border-rust-500/25',
  info: 'bg-cane-500/10 text-cane-600 border-cane-500/25',
  neutral: 'bg-stone-200 text-ink-500 border-stone-300',
};

// Every status vocabulary used across the app (record status, approval status,
// PO status, stock status, batch status, cane status) maps to one semantic bucket.
const STATUS_BUCKET = {
  ACTIVE: 'success',
  APPROVED: 'success',
  COMPLETED: 'success',
  RECEIVED: 'success',
  CRUSHED: 'success',
  NORMAL: 'success',
  PENDING: 'warning',
  PARTIALLY_RECEIVED: 'warning',
  PARTIALLY_CRUSHED: 'warning',
  LOW_STOCK: 'warning',
  DRAFT: 'neutral',
  PLANNED: 'neutral',
  INACTIVE: 'neutral',
  IN_PROGRESS: 'info',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  OUT_OF_STOCK: 'danger',
};

export default function StatusBadge({ status }) {
  const bucket = STATUS_BUCKET[status] || 'neutral';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${BUCKETS[bucket]}`}>
      {toSentenceCase(status)}
    </span>
  );
}
