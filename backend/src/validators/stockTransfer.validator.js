const { z } = require('zod');

const transferLineSchema = z.object({
  itemId: z.coerce.number().int().positive('Item is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
});

const createStockTransferSchema = z
  .object({
    sourceWarehouseId: z.coerce.number().int().positive('Source warehouse is required'),
    destinationWarehouseId: z.coerce.number().int().positive('Destination warehouse is required'),
    items: z.array(transferLineSchema).min(1, 'At least one line item is required'),
  })
  .refine((v) => v.sourceWarehouseId !== v.destinationWarehouseId, {
    message: 'Source and destination warehouses must be different',
    path: ['destinationWarehouseId'],
  });

const listStockTransferQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'REJECTED']).optional(),
  sourceWarehouseId: z.coerce.number().int().positive().optional(),
  destinationWarehouseId: z.coerce.number().int().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createStockTransferSchema, listStockTransferQuerySchema };
