import { toSentenceCase } from '../utils/format';

export const RECORD_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export const STOCK_STATUS_OPTIONS = [
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  { value: 'LOW_STOCK', label: 'Low stock' },
  { value: 'NORMAL', label: 'Normal' },
];

// Mirrors the MovementType enum in prisma/schema.prisma.
export const MOVEMENT_TYPES = [
  'PURCHASE_RECEIPT',
  'STOCK_ISSUE',
  'PRODUCTION_CONSUMPTION',
  'STOCK_TRANSFER_IN',
  'STOCK_TRANSFER_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'RETURN',
];

export const INCOMING_MOVEMENT_TYPES = new Set(['PURCHASE_RECEIPT', 'STOCK_TRANSFER_IN', 'ADJUSTMENT_IN', 'RETURN']);

export const MOVEMENT_TYPE_OPTIONS = MOVEMENT_TYPES.map((t) => ({ value: t, label: toSentenceCase(t) }));

// Matches the department list in backend/src/validators/stockIssue.validator.js.
export const DEPARTMENTS = ['PRODUCTION', 'MAINTENANCE', 'BOILER', 'ELECTRICAL', 'PACKAGING', 'ADMINISTRATION', 'OTHER'];
export const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d, label: toSentenceCase(d) }));

export const BATCH_STATUS_OPTIONS = [
  { value: 'PLANNED', label: 'Planned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
];

export const CANE_STATUS_OPTIONS = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'PARTIALLY_CRUSHED', label: 'Partially crushed' },
  { value: 'CRUSHED', label: 'Crushed' },
];

// Mirrors the AdjustmentReason enum in prisma/schema.prisma.
export const ADJUSTMENT_REASONS = ['DAMAGED', 'EXPIRED', 'PHYSICAL_DIFFERENCE', 'CORRECTION', 'LOSS', 'OTHER'];
export const ADJUSTMENT_REASON_OPTIONS = ADJUSTMENT_REASONS.map((r) => ({ value: r, label: toSentenceCase(r) }));
