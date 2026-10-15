const { z } = require('zod');

const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  stockStatus: z.enum(['OUT_OF_STOCK', 'LOW_STOCK', 'NORMAL']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const itemIdParamSchema = z.object({
  itemId: z.coerce.number().int().positive('Invalid item id'),
});

module.exports = { listInventoryQuerySchema, itemIdParamSchema };
