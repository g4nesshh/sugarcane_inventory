/**
 * Stock Adjustment: reconciles a physical count against the system quantity.
 * The system quantity and the resulting difference are captured once, at request
 * time (per spec) — approval applies that stored difference, it doesn't re-snapshot.
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { applyMovement, runInTransaction } = require('../utils/stockService');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

async function generateAdjustmentNumber(tx) {
  const prefix = `ADJ-${new Date().toISOString().slice(0, 7).replace('-', '')}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const countThisMonth = await tx.stockAdjustment.count({ where: { adjustmentNumber: { startsWith: prefix } } });
    const candidate = `${prefix}-${String(countThisMonth + 1 + attempt).padStart(4, '0')}`;
    const exists = await tx.stockAdjustment.findUnique({ where: { adjustmentNumber: candidate } });
    if (!exists) return candidate;
  }
  throw new AppError(500, 'ADJUSTMENT_NUMBER_GENERATION_FAILED', 'Could not generate a unique adjustment number, please retry');
}

const adjustmentInclude = {
  item: { select: { id: true, itemCode: true, name: true, unit: true } },
  warehouse: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true } },
  approver: { select: { id: true, name: true } },
};

async function create(data, userId) {
  const item = await prisma.item.findUnique({ where: { id: data.itemId } });
  if (!item) throw new AppError(400, 'INVALID_ITEM', 'Item does not exist');
  const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId } });
  if (!warehouse) throw new AppError(400, 'INVALID_WAREHOUSE', 'Warehouse does not exist');

  const inventory = await prisma.inventory.findUnique({
    where: { itemId_warehouseId: { itemId: data.itemId, warehouseId: data.warehouseId } },
  });
  const systemQuantity = inventory ? inventory.quantity : new Prisma.Decimal(0);
  const difference = new Prisma.Decimal(data.physicalQuantity).minus(systemQuantity);

  return runInTransaction(async (tx) => {
    const adjustmentNumber = await generateAdjustmentNumber(tx);
    return tx.stockAdjustment.create({
      data: {
        adjustmentNumber,
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        systemQuantity,
        physicalQuantity: data.physicalQuantity,
        difference,
        reason: data.reason,
        remarks: data.remarks,
        requestedBy: userId,
        status: 'PENDING',
      },
      include: adjustmentInclude,
    });
  });
}

async function getRaw(id) {
  const adjustment = await prisma.stockAdjustment.findUnique({ where: { id }, include: adjustmentInclude });
  if (!adjustment) throw new AppError(404, 'NOT_FOUND', 'Stock adjustment not found');
  return adjustment;
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const where = {
    ...(query.itemId && { itemId: query.itemId }),
    ...(query.warehouseId && { warehouseId: query.warehouseId }),
    ...(query.reason && { reason: query.reason }),
    ...(query.status && { status: query.status }),
  };

  const [adjustments, total] = await Promise.all([
    prisma.stockAdjustment.findMany({ where, orderBy: { createdAt: sortOrder }, skip, take, include: adjustmentInclude }),
    prisma.stockAdjustment.count({ where }),
  ]);

  return { adjustments, meta: buildMeta({ page, limit, total }) };
}

// Approving applies the difference captured at request time as a single ADJUSTMENT_IN
// or ADJUSTMENT_OUT movement. A zero difference approves with no stock movement at all.
async function approve(id, userId) {
  const existing = await getRaw(id);
  if (existing.status !== 'PENDING') {
    throw new AppError(409, 'ADJUSTMENT_NOT_PENDING', `Only a pending adjustment can be approved (current status: ${existing.status})`);
  }

  const difference = new Prisma.Decimal(existing.difference);

  const updated = await runInTransaction(async (tx) => {
    if (!difference.isZero()) {
      await applyMovement(tx, {
        itemId: existing.itemId,
        warehouseId: existing.warehouseId,
        type: difference.gt(0) ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        quantity: difference.abs(),
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: existing.id,
        referenceNumber: existing.adjustmentNumber,
        userId,
        remarks: `${existing.reason}: ${existing.remarks || 'stock adjustment'}`,
      });
    }
    return tx.stockAdjustment.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: userId },
      include: adjustmentInclude,
    });
  });

  return updated;
}

async function reject(id, userId) {
  const existing = await getRaw(id);
  if (existing.status !== 'PENDING') {
    throw new AppError(409, 'ADJUSTMENT_NOT_PENDING', `Only a pending adjustment can be rejected (current status: ${existing.status})`);
  }
  return prisma.stockAdjustment.update({
    where: { id },
    data: { status: 'REJECTED', approvedBy: userId },
    include: adjustmentInclude,
  });
}

module.exports = { create, list, getById: getRaw, approve, reject };
