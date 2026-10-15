const { z } = require('zod');

const REASONS = ['DAMAGED', 'EXPIRED', 'PHYSICAL_DIFFERENCE', 'CORRECTION', 'LOSS', 'OTHER'];

const createStockAdjustmentSchema = z.object({
  itemId: z.coerce.number().int().positive('Item is required'),
  warehouseId: z.coerce.number().int().positive('Warehouse is required'),
  physicalQuantity: z.coerce.number().nonnegative('Physical quantity cannot be negative'),
  reason: z.enum(REASONS),
  remarks: z.string().trim().max(500).optional(),
});

const listStockAdjustmentQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  itemId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  reason: z.enum(REASONS).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createStockAdjustmentSchema, listStockAdjustmentQuerySchema, REASONS };
