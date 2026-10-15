/**
 * Single choke point for every stock change.
 * Every inventory operation (receipt, issue, transfer, consumption, adjustment)
 * calls applyMovement inside one Prisma transaction. It:
 *   1. locks the Inventory row (SELECT ... FOR UPDATE) so concurrent requests serialize
 *   2. refuses to let stock go negative
 *   3. updates the quantity
 *   4. writes an immutable StockMovement ledger row
 */
const { Prisma } = require('@prisma/client');
const prisma = require('./prisma');
const AppError = require('./AppError');

const INCOMING = new Set(['PURCHASE_RECEIPT', 'STOCK_TRANSFER_IN', 'ADJUSTMENT_IN', 'RETURN']);
const OUTGOING = new Set(['STOCK_ISSUE', 'PRODUCTION_CONSUMPTION', 'STOCK_TRANSFER_OUT', 'ADJUSTMENT_OUT']);

async function applyMovement(tx, params) {
  const {
    itemId, warehouseId, type, quantity,
    referenceType, referenceId = null, referenceNumber = null,
    userId, remarks = null,
  } = params;

  if (!INCOMING.has(type) && !OUTGOING.has(type)) {
    throw new AppError(400, 'INVALID_MOVEMENT_TYPE', `Unknown movement type: ${type}`);
  }
  const qty = new Prisma.Decimal(quantity);
  if (!qty.isFinite() || qty.lte(0)) {
    throw new AppError(400, 'INVALID_QUANTITY', 'Quantity must be greater than zero');
  }

  // Ensure the row exists so it can be locked (incoming stock may create it).
  await tx.inventory.upsert({
    where: { itemId_warehouseId: { itemId, warehouseId } },
    update: {},
    create: { itemId, warehouseId, quantity: 0 },
  });

  const rows = await tx.$queryRaw`
    SELECT "id", "quantity" FROM "Inventory"
    WHERE "itemId" = ${itemId} AND "warehouseId" = ${warehouseId}
    FOR UPDATE`;

  const previous = new Prisma.Decimal(rows[0].quantity);
  const next = INCOMING.has(type) ? previous.plus(qty) : previous.minus(qty);

  if (next.lt(0)) {
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      `Insufficient stock: available ${previous.toString()}, requested ${qty.toString()}`
    );
  }

  await tx.inventory.update({ where: { id: rows[0].id }, data: { quantity: next } });

  return tx.stockMovement.create({
    data: {
      itemId, warehouseId, type,
      quantity: qty,
      previousQuantity: previous,
      newQuantity: next,
      referenceType, referenceId, referenceNumber,
      performedBy: userId,
      remarks,
    },
  });
}

/** Run several movements atomically: all succeed or none do. */
const runInTransaction = (fn) => prisma.$transaction(fn, { maxWait: 5000, timeout: 20000 });

module.exports = { applyMovement, runInTransaction, INCOMING, OUTGOING };
