const { z } = require('zod');

const BATCH_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];

const createProductionBatchSchema = z.object({
  product: z.string().trim().min(1, 'Product name is required').max(150),
  productionDate: z.coerce.date().optional(),
  quantityProduced: z.coerce.number().nonnegative().default(0),
});

const updateProductionBatchSchema = z.object({
  product: z.string().trim().min(1).max(150).optional(),
  productionDate: z.coerce.date().optional(),
  quantityProduced: z.coerce.number().nonnegative().optional(),
  status: z.enum(BATCH_STATUSES).optional(),
});

const listProductionBatchQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  status: z.enum(BATCH_STATUSES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createProductionBatchSchema, updateProductionBatchSchema, listProductionBatchQuerySchema, BATCH_STATUSES };
