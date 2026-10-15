const { z } = require('zod');

const createSugarcaneReceiptSchema = z
  .object({
    supplierId: z.coerce.number().int().positive('Supplier is required'),
    itemId: z.coerce.number().int().positive('Item is required'),
    warehouseId: z.coerce.number().int().positive('Warehouse is required'),
    vehicleNumber: z.string().trim().min(1, 'Vehicle number is required').max(30),
    grossWeight: z.coerce.number().positive('Gross weight must be greater than zero'),
    tareWeight: z.coerce.number().nonnegative('Tare weight cannot be negative'),
    quality: z.string().trim().max(50).optional(),
    unloadingLocation: z.string().trim().max(100).optional(),
    arrivalDate: z.coerce.date().optional(),
  })
  .refine((v) => v.grossWeight > v.tareWeight, {
    message: 'Gross weight must be greater than tare weight',
    path: ['grossWeight'],
  });

const crushSugarcaneSchema = z.object({
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
});

const listSugarcaneQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  supplierId: z.coerce.number().int().positive().optional(),
  status: z.enum(['RECEIVED', 'PARTIALLY_CRUSHED', 'CRUSHED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createSugarcaneReceiptSchema, crushSugarcaneSchema, listSugarcaneQuerySchema };
