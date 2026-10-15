const { z } = require('zod');

const createItemSchema = z
  .object({
    itemCode: z.string().trim().min(1, 'Item code is required').max(50),
    name: z.string().trim().min(1, 'Name is required').max(150),
    categoryId: z.coerce.number().int().positive('Category is required'),
    supplierId: z.coerce.number().int().positive().optional(),
    unit: z.string().trim().min(1, 'Unit is required').max(20),
    description: z.string().trim().max(1000).optional(),
    minimumStock: z.coerce.number().nonnegative().default(0),
    maximumStock: z.coerce.number().nonnegative().default(0),
    reorderLevel: z.coerce.number().nonnegative().default(0),
    unitCost: z.coerce.number().nonnegative().default(0),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .refine((v) => v.maximumStock === 0 || v.maximumStock >= v.minimumStock, {
    message: 'Maximum stock must be greater than or equal to minimum stock',
    path: ['maximumStock'],
  });

const updateItemSchema = z
  .object({
    itemCode: z.string().trim().min(1).max(50).optional(),
    name: z.string().trim().min(1).max(150).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    supplierId: z.coerce.number().int().positive().nullable().optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    description: z.string().trim().max(1000).optional(),
    minimumStock: z.coerce.number().nonnegative().optional(),
    maximumStock: z.coerce.number().nonnegative().optional(),
    reorderLevel: z.coerce.number().nonnegative().optional(),
    unitCost: z.coerce.number().nonnegative().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  });

const listItemQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  stockStatus: z.enum(['OUT_OF_STOCK', 'LOW_STOCK', 'NORMAL']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createItemSchema, updateItemSchema, listItemQuerySchema };
