const { z } = require('zod');

const receiptItemSchema = z.object({
  itemId: z.coerce.number().int().positive('Item is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  batchNumber: z.string().trim().max(50).optional(),
  expiryDate: z.coerce.date().optional(),
});

const createGoodsReceiptSchema = z.object({
  purchaseOrderId: z.coerce.number().int().positive('Purchase order is required'),
  warehouseId: z.coerce.number().int().positive('Warehouse is required'),
  // Optional client-supplied idempotency key: retrying a receipt submission with the
  // same key returns the original receipt instead of receiving stock a second time.
  idempotencyKey: z.string().trim().max(100).optional(),
  items: z.array(receiptItemSchema).min(1, 'At least one line item is required'),
});

const listGoodsReceiptQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  purchaseOrderId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createGoodsReceiptSchema, listGoodsReceiptQuerySchema };
