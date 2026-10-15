const { z } = require('zod');

// Kept in sync with the MovementType enum in prisma/schema.prisma. Duplicated here
// (rather than imported from @prisma/client) so validation doesn't depend on
// `prisma generate` having run, and stays stable if the client is regenerated.
const MOVEMENT_TYPES = [
  'PURCHASE_RECEIPT',
  'STOCK_ISSUE',
  'PRODUCTION_CONSUMPTION',
  'STOCK_TRANSFER_IN',
  'STOCK_TRANSFER_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'RETURN',
];

const listMovementQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    itemId: z.coerce.number().int().positive().optional(),
    warehouseId: z.coerce.number().int().positive().optional(),
    type: z.enum(MOVEMENT_TYPES).optional(),
    referenceType: z.string().trim().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, {
    message: 'dateFrom must be before dateTo',
    path: ['dateFrom'],
  });

module.exports = { listMovementQuerySchema, MOVEMENT_TYPES };
