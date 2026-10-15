const { z } = require('zod');

const createWarehouseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  location: z.string().trim().max(200).optional(),
  manager: z.string().trim().max(100).optional(),
  capacity: z.coerce.number().nonnegative().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const updateWarehouseSchema = createWarehouseSchema.partial();

const listWarehouseQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createWarehouseSchema, updateWarehouseSchema, listWarehouseQuerySchema };
