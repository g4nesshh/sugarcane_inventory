const { z } = require('zod');

const formatField = z.enum(['json', 'csv']).optional();

const inventoryReportQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  format: formatField,
});

const purchaseReportQuerySchema = z.object({
  supplierId: z.coerce.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  format: formatField,
});

const consumptionReportQuerySchema = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  productionBatchId: z.coerce.number().int().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  format: formatField,
});

const stockMovementReportQuerySchema = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  type: z
    .enum([
      'PURCHASE_RECEIPT',
      'STOCK_ISSUE',
      'PRODUCTION_CONSUMPTION',
      'STOCK_TRANSFER_IN',
      'STOCK_TRANSFER_OUT',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'RETURN',
    ])
    .optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  format: formatField,
});

module.exports = {
  inventoryReportQuerySchema,
  purchaseReportQuerySchema,
  consumptionReportQuerySchema,
  stockMovementReportQuerySchema,
};
