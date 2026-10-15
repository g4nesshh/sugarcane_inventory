/**
 * Pure unit tests for Zod validators — no database, no Prisma client, no network.
 * These run anywhere (including environments where `prisma generate` is blocked)
 * because they only exercise schema-parsing logic.
 */
const { loginSchema, registerSchema } = require('../../src/validators/auth.validator');
const { createItemSchema } = require('../../src/validators/item.validator');
const { createPurchaseOrderSchema, updatePurchaseOrderSchema } = require('../../src/validators/purchaseOrder.validator');
const { createGoodsReceiptSchema } = require('../../src/validators/goodsReceipt.validator');
const { createStockIssueSchema } = require('../../src/validators/stockIssue.validator');
const { createStockTransferSchema } = require('../../src/validators/stockTransfer.validator');
const { createSugarcaneReceiptSchema, crushSugarcaneSchema } = require('../../src/validators/sugarcane.validator');
const { createStockAdjustmentSchema } = require('../../src/validators/stockAdjustment.validator');
const { idParamSchema } = require('../../src/validators/common.validator');

describe('auth.validator', () => {
  test('accepts a well-formed login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });

  test('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  test('registerSchema enforces password strength (letter + number, 8+ chars)', () => {
    expect(registerSchema.safeParse({ name: 'Jo', email: 'a@b.com', password: 'alllower', role: 'ADMIN' }).success).toBe(false);
    expect(registerSchema.safeParse({ name: 'Jo', email: 'a@b.com', password: 'short1', role: 'ADMIN' }).success).toBe(false);
    expect(registerSchema.safeParse({ name: 'Jo', email: 'a@b.com', password: 'goodPass1', role: 'ADMIN' }).success).toBe(true);
  });

  test('registerSchema rejects a name shorter than 2 characters', () => {
    expect(registerSchema.safeParse({ name: 'A', email: 'a@b.com', password: 'goodPass1', role: 'ADMIN' }).success).toBe(false);
  });
});

describe('item.validator', () => {
  test('rejects maximumStock below minimumStock', () => {
    const result = createItemSchema.safeParse({
      itemCode: 'X1', name: 'Test', categoryId: 1, unit: 'KG', minimumStock: 100, maximumStock: 10,
    });
    expect(result.success).toBe(false);
  });

  test('accepts maximumStock of 0 (treated as "no cap")', () => {
    const result = createItemSchema.safeParse({
      itemCode: 'X1', name: 'Test', categoryId: 1, unit: 'KG', minimumStock: 50, maximumStock: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe('purchaseOrder.validator', () => {
  test('rejects an empty items array', () => {
    expect(createPurchaseOrderSchema.safeParse({ supplierId: 1, items: [] }).success).toBe(false);
  });

  test('rejects a zero-quantity line item', () => {
    const result = createPurchaseOrderSchema.safeParse({
      supplierId: 1, items: [{ itemId: 1, orderedQuantity: 0, unitPrice: 5 }],
    });
    expect(result.success).toBe(false);
  });

  test('update schema allows manual DRAFT/PENDING/APPROVED/CANCELLED but rejects RECEIVED/PARTIALLY_RECEIVED', () => {
    expect(updatePurchaseOrderSchema.safeParse({ status: 'PENDING' }).success).toBe(true);
    expect(updatePurchaseOrderSchema.safeParse({ status: 'APPROVED' }).success).toBe(true);
    expect(updatePurchaseOrderSchema.safeParse({ status: 'RECEIVED' }).success).toBe(false);
    expect(updatePurchaseOrderSchema.safeParse({ status: 'PARTIALLY_RECEIVED' }).success).toBe(false);
  });
});

describe('goodsReceipt.validator', () => {
  test('rejects a receipt with no line items', () => {
    expect(createGoodsReceiptSchema.safeParse({ purchaseOrderId: 1, warehouseId: 1, items: [] }).success).toBe(false);
  });

  test('accepts an optional idempotencyKey', () => {
    const result = createGoodsReceiptSchema.safeParse({
      purchaseOrderId: 1, warehouseId: 1, idempotencyKey: 'abc-123', items: [{ itemId: 1, quantity: 10 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('stockIssue.validator', () => {
  test('rejects a department outside the known list', () => {
    const result = createStockIssueSchema.safeParse({
      department: 'KITCHEN', items: [{ itemId: 1, warehouseId: 1, quantity: 5 }],
    });
    expect(result.success).toBe(false);
  });

  test('accepts a known department with a valid line', () => {
    const result = createStockIssueSchema.safeParse({
      department: 'BOILER', items: [{ itemId: 1, warehouseId: 1, quantity: 5 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('stockTransfer.validator', () => {
  test('rejects identical source and destination warehouses', () => {
    const result = createStockTransferSchema.safeParse({
      sourceWarehouseId: 1, destinationWarehouseId: 1, items: [{ itemId: 1, quantity: 5 }],
    });
    expect(result.success).toBe(false);
  });

  test('accepts different source and destination warehouses', () => {
    const result = createStockTransferSchema.safeParse({
      sourceWarehouseId: 1, destinationWarehouseId: 2, items: [{ itemId: 1, quantity: 5 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('sugarcane.validator', () => {
  test('rejects gross weight not greater than tare weight', () => {
    const result = createSugarcaneReceiptSchema.safeParse({
      supplierId: 1, itemId: 1, warehouseId: 1, vehicleNumber: 'MH12AB1234', grossWeight: 2000, tareWeight: 2000,
    });
    expect(result.success).toBe(false);
  });

  test('accepts gross weight greater than tare weight', () => {
    const result = createSugarcaneReceiptSchema.safeParse({
      supplierId: 1, itemId: 1, warehouseId: 1, vehicleNumber: 'MH12AB1234', grossWeight: 5000, tareWeight: 2000,
    });
    expect(result.success).toBe(true);
  });

  test('crush schema rejects a zero or negative quantity', () => {
    expect(crushSugarcaneSchema.safeParse({ quantity: 0 }).success).toBe(false);
    expect(crushSugarcaneSchema.safeParse({ quantity: -5 }).success).toBe(false);
    expect(crushSugarcaneSchema.safeParse({ quantity: 100 }).success).toBe(true);
  });
});

describe('stockAdjustment.validator', () => {
  test('rejects an unknown reason', () => {
    const result = createStockAdjustmentSchema.safeParse({
      itemId: 1, warehouseId: 1, physicalQuantity: 50, reason: 'MADE_UP',
    });
    expect(result.success).toBe(false);
  });

  test('rejects a negative physical quantity', () => {
    const result = createStockAdjustmentSchema.safeParse({
      itemId: 1, warehouseId: 1, physicalQuantity: -5, reason: 'LOSS',
    });
    expect(result.success).toBe(false);
  });

  test('accepts a valid adjustment request', () => {
    const result = createStockAdjustmentSchema.safeParse({
      itemId: 1, warehouseId: 1, physicalQuantity: 50, reason: 'PHYSICAL_DIFFERENCE',
    });
    expect(result.success).toBe(true);
  });
});

describe('common.validator', () => {
  test('idParamSchema coerces a numeric string and rejects non-numeric input', () => {
    expect(idParamSchema.safeParse({ id: '42' })).toMatchObject({ success: true, data: { id: 42 } });
    expect(idParamSchema.safeParse({ id: 'abc' }).success).toBe(false);
    expect(idParamSchema.safeParse({ id: '-1' }).success).toBe(false);
  });
});

describe('Zod mass-assignment protection (applies to every schema above)', () => {
  test('unknown fields are silently stripped, never passed through', () => {
    const result = createItemSchema.safeParse({
      itemCode: 'X1', name: 'Test', categoryId: 1, unit: 'KG',
      role: 'ADMIN', approvedBy: 999, status: 'ACTIVE', // status IS a real optional field; role/approvedBy are not
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('role');
    expect(result.data).not.toHaveProperty('approvedBy');
  });
});
