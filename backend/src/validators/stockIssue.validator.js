const { z } = require('zod');

// Matches the department list in the spec (section 9). Stored as-is on the issue.
const DEPARTMENTS = ['PRODUCTION', 'MAINTENANCE', 'BOILER', 'ELECTRICAL', 'PACKAGING', 'ADMINISTRATION', 'OTHER'];

const issueLineSchema = z.object({
  itemId: z.coerce.number().int().positive('Item is required'),
  warehouseId: z.coerce.number().int().positive('Warehouse is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
});

const createStockIssueSchema = z.object({
  department: z.enum(DEPARTMENTS),
  purpose: z.string().trim().max(300).optional(),
  remarks: z.string().trim().max(1000).optional(),
  items: z.array(issueLineSchema).min(1, 'At least one line item is required'),
});

const decisionSchema = z.object({
  remarks: z.string().trim().max(1000).optional(),
});

const listStockIssueQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  department: z.enum(DEPARTMENTS).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createStockIssueSchema, decisionSchema, listStockIssueQuerySchema, DEPARTMENTS };
