const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Valid email required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  role: z.enum(['ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER', 'STOREKEEPER']),
});

module.exports = { loginSchema, registerSchema };
