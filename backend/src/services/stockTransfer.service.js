/**
 * Stock Transfer: a request first, stock only moves on approval — and when it
 * does, every line's source-decrease and destination-increase happen inside the
 * SAME transaction as every other line, so a transfer is all-or-nothing.
 */
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { applyMovement, runInTransaction } = require('../utils/stockService');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

async function generateTransferNumber(tx) {
  const prefix = `TRF-${new Date().toISOString().slice(0, 7).replace('-', '')}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const countThisMonth = await tx.stockTransfer.count({ where: { transferNumber: { startsWith: prefix } } });
    const candidate = `${prefix}-${String(countThisMonth + 1 + attempt).padStart(4, '0')}`;
    const exists = await tx.stockTransfer.findUnique({ where: { transferNumber: candidate } });
    if (!exists) return candidate;
  }
  throw new AppError(500, 'TRANSFER_NUMBER_GENERATION_FAILED', 'Could not generate a unique transfer number, please retry');
}

const transferInclude = {
  source: { select: { id: true, name: true } },
  destination: { select: { id: true, name: true } },
  items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
};

async function assertWarehouseActive(id, label) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) throw new AppError(400, 'INVALID_WAREHOUSE', `${label} warehouse does not exist`);
  if (warehouse.status !== 'ACTIVE') throw new AppError(400, 'WAREHOUSE_INACTIVE', `${label} warehouse is not active`);
  return warehouse;
}

async function assertItemsActive(items) {
  const ids = [...new Set(items.map((i) => i.itemId))];
  const found = await prisma.item.findMany({ where: { id: { in: ids } } });
  if (found.length !== ids.length) throw new AppError(400, 'INVALID_ITEM', 'One or more selected items do not exist');
  const inactive = found.find((i) => i.status !== 'ACTIVE');
  if (inactive) throw new AppError(400, 'ITEM_INACTIVE', `Item "${inactive.name}" is not active`);
}

async function create(data, userId) {
  await assertWarehouseActive(data.sourceWarehouseId, 'Source');
  await assertWarehouseActive(data.destinationWarehouseId, 'Destination');
  await assertItemsActive(data.items);

  return runInTransaction(async (tx) => {
    const transferNumber = await generateTransferNumber(tx);
    return tx.stockTransfer.create({
      data: {
        transferNumber,
        sourceWarehouseId: data.sourceWarehouseId,
        destinationWarehouseId: data.destinationWarehouseId,
        requestedBy: userId,
        status: 'PENDING',
        items: { create: data.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })) },
      },
      include: transferInclude,
    });
  });
}

async function getById(id) {
  const transfer = await prisma.stockTransfer.findUnique({ where: { id }, include: transferInclude });
  if (!transfer) throw new AppError(404, 'NOT_FOUND', 'Stock transfer not found');
  return transfer;
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const where = {
    ...(query.status && { status: query.status }),
    ...(query.sourceWarehouseId && { sourceWarehouseId: query.sourceWarehouseId }),
    ...(query.destinationWarehouseId && { destinationWarehouseId: query.destinationWarehouseId }),
    ...((query.dateFrom || query.dateTo) && {
      createdAt: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
  };

  const [transfers, total] = await Promise.all([
    prisma.stockTransfer.findMany({ where, orderBy: { createdAt: sortOrder }, skip, take, include: transferInclude }),
    prisma.stockTransfer.count({ where }),
  ]);

  return { transfers, meta: buildMeta({ page, limit, total }) };
}

// The atomic part: every line's OUT (source) and IN (destination) movement happens
// inside this one transaction. If any line's source has insufficient stock,
// applyMovement throws and the whole transfer — every line, both sides — rolls back.
async function approve(id, userId) {
  const existing = await getById(id);
  if (existing.status !== 'PENDING') {
    throw new AppError(409, 'TRANSFER_NOT_PENDING', `Only a pending transfer can be approved (current status: ${existing.status})`);
  }

  return runInTransaction(async (tx) => {
    for (const line of existing.items) {
      await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: existing.sourceWarehouseId,
        type: 'STOCK_TRANSFER_OUT',
        quantity: line.quantity,
        referenceType: 'STOCK_TRANSFER',
        referenceId: existing.id,
        referenceNumber: existing.transferNumber,
        userId,
        remarks: `Transfer to ${existing.destination.name}`,
      });
      await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: existing.destinationWarehouseId,
        type: 'STOCK_TRANSFER_IN',
        quantity: line.quantity,
        referenceType: 'STOCK_TRANSFER',
        referenceId: existing.id,
        referenceNumber: existing.transferNumber,
        userId,
        remarks: `Transfer from ${existing.source.name}`,
      });
    }

    return tx.stockTransfer.update({
      where: { id },
      data: { status: 'COMPLETED', approvedBy: userId },
      include: transferInclude,
    });
  });
}

async function reject(id, userId) {
  const existing = await getById(id);
  if (existing.status !== 'PENDING') {
    throw new AppError(409, 'TRANSFER_NOT_PENDING', `Only a pending transfer can be rejected (current status: ${existing.status})`);
  }
  return prisma.stockTransfer.update({
    where: { id },
    data: { status: 'REJECTED', approvedBy: userId },
    include: transferInclude,
  });
}

module.exports = { create, list, getById, approve, reject };
