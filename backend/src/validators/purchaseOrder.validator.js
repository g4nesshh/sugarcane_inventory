const { z } = require('zod');

const PO_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];
// Statuses a caller may set directly via PUT. PARTIALLY_RECEIVED / RECEIVED are set
// only by the goods-receipt workflow (Phase 6), never by hand.
const MANUAL_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'CANCELLED'];

const poItemSchema = z.object({
  itemId: z.coerce.number().int().positive('Item is required'),
  orderedQuantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unitPrice: z.coerce.number().nonnegative('Unit price cannot be negative'),
});

const createPurchaseOrderSchema = z.object({
  supplierId: z.coerce.number().int().positive('Supplier is required'),
  expectedDate: z.coerce.date().optional(),
  tax: z.coerce.number().nonnegative().default(0),
  discount: z.coerce.number().nonnegative().default(0),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(poItemSchema).min(1, 'At least one line item is required'),
});

const updatePurchaseOrderSchema = z.object({
  supplierId: z.coerce.number().int().positive().optional(),
  expectedDate: z.coerce.date().optional(),
  tax: z.coerce.number().nonnegative().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(poItemSchema).min(1).optional(),
  status: z.enum(MANUAL_STATUSES).optional(),
});

const listPurchaseOrderQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  status: z.enum(PO_STATUSES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  listPurchaseOrderQuerySchema,
  PO_STATUSES,
  MANUAL_STATUSES,
};
