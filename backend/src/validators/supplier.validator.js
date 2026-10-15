const { z } = require('zod');

const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  contactPerson: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().toLowerCase().email('Invalid email').optional().or(z.literal('')),
  address: z.string().trim().max(300).optional(),
  gstNumber: z.string().trim().max(20).optional(),
  supplierType: z.string().trim().max(50).optional(),
  paymentTerms: z.string().trim().max(50).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const updateSupplierSchema = createSupplierSchema.partial();

const listSupplierQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  supplierType: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

module.exports = { createSupplierSchema, updateSupplierSchema, listSupplierQuerySchema };
