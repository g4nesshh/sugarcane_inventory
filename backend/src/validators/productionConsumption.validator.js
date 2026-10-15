const { z } = require('zod');

const consumptionLineSchema = z.object({
  itemId: z.coerce.number().int().positive('Item is required'),
  warehouseId: z.coerce.number().int().positive('Warehouse is required'),
  quantityConsumed: z.coerce.number().positive('Quantity must be greater than zero'),
  department: z.string().trim().max(50).optional(),
  remarks: z.string().trim().max(500).optional(),
});

const createConsumptionSchema = z.object({
  productionBatchId: z.coerce.number().int().positive('Production batch is required'),
  items: z.array(consumptionLineSchema).min(1, 'At least one line item is required'),
});

const listConsumptionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  productionBatchId: z.coerce.number().int().positive().optional(),
  itemId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createConsumptionSchema, listConsumptionQuerySchema };
