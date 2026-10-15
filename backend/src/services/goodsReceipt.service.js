/**
 * Goods Receipt: the only place a purchase order's items turn into real stock.
 * Everything below runs in ONE transaction so a receipt, its stock increases,
 * and its purchase-order-line updates all succeed or all roll back together.
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { applyMovement, runInTransaction } = require('../utils/stockService');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

const RECEIVABLE_STATUSES = ['APPROVED', 'PARTIALLY_RECEIVED'];

async function generateReceiptNumber(tx) {
  const prefix = `GR-${new Date().toISOString().slice(0, 7).replace('-', '')}`; // GR-YYYYMM
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const countThisMonth = await tx.goodsReceipt.count({ where: { receiptNumber: { startsWith: prefix } } });
    const candidate = `${prefix}-${String(countThisMonth + 1 + attempt).padStart(4, '0')}`;
    const exists = await tx.goodsReceipt.findUnique({ where: { receiptNumber: candidate } });
    if (!exists) return candidate;
  }
  throw new AppError(500, 'RECEIPT_NUMBER_GENERATION_FAILED', 'Could not generate a unique receipt number, please retry');
}

const receiptInclude = {
  purchaseOrder: { select: { id: true, poNumber: true, status: true, supplier: { select: { id: true, name: true } } } },
  warehouse: { select: { id: true, name: true } },
  receiver: { select: { id: true, name: true } },
  items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
};

async function create(data, userId) {
  return runInTransaction(async (tx) => {
    // Idempotent replay: if this exact submission was already processed, hand back
    // the original receipt instead of receiving the same stock a second time.
    if (data.idempotencyKey) {
      const existing = await tx.goodsReceipt.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: receiptInclude,
      });
      if (existing) return existing;
    }

    const po = await tx.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId }, include: { items: true } });
    if (!po) throw new AppError(400, 'INVALID_PURCHASE_ORDER', 'Purchase order does not exist');
    if (!RECEIVABLE_STATUSES.includes(po.status)) {
      throw new AppError(
        409,
        'PO_NOT_RECEIVABLE',
        `Purchase order must be Approved before it can be received (current status: ${po.status})`
      );
    }

    const warehouse = await tx.warehouse.findUnique({ where: { id: data.warehouseId } });
    if (!warehouse) throw new AppError(400, 'INVALID_WAREHOUSE', 'Warehouse does not exist');
    if (warehouse.status !== 'ACTIVE') throw new AppError(400, 'WAREHOUSE_INACTIVE', 'Warehouse is not active');

    const poItemsByItemId = new Map(po.items.map((line) => [line.itemId, line]));

    // Validate every line against what the PO actually ordered before writing anything,
    // so a bad line in a multi-item receipt fails the whole request instead of partially applying.
    for (const line of data.items) {
      const poLine = poItemsByItemId.get(line.itemId);
      if (!poLine) {
        throw new AppError(400, 'ITEM_NOT_ON_PURCHASE_ORDER', `Item ${line.itemId} is not on purchase order ${po.poNumber}`);
      }
      const remaining = new Prisma.Decimal(poLine.orderedQuantity).minus(poLine.receivedQuantity);
      if (new Prisma.Decimal(line.quantity).gt(remaining)) {
        throw new AppError(
          409,
          'OVER_RECEIPT',
          `Cannot receive ${line.quantity} of item ${line.itemId}; only ${remaining.toString()} remaining on ${po.poNumber}`
        );
      }
    }

    const receiptNumber = await generateReceiptNumber(tx);
    const receipt = await tx.goodsReceipt.create({
      data: {
        receiptNumber,
        purchaseOrderId: po.id,
        warehouseId: data.warehouseId,
        receivedBy: userId,
        idempotencyKey: data.idempotencyKey ?? null,
        items: {
          create: data.items.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate,
          })),
        },
      },
    });

    // Increase stock and advance the PO line for each item — the ledger entry
    // (via applyMovement) is what makes this receipt visible in stock history.
    for (const line of data.items) {
      const poLine = poItemsByItemId.get(line.itemId);
      await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: data.warehouseId,
        type: 'PURCHASE_RECEIPT',
        quantity: line.quantity,
        referenceType: 'GOODS_RECEIPT',
        referenceId: receipt.id,
        referenceNumber: receiptNumber,
        userId,
        remarks: `Received against ${po.poNumber}`,
      });
      await tx.purchaseOrderItem.update({
        where: { id: poLine.id },
        data: { receivedQuantity: { increment: line.quantity } },
      });
    }

    // Recompute the PO's overall status from its lines' fresh received quantities.
    const refreshedLines = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
    const fullyReceived = refreshedLines.every((l) => new Prisma.Decimal(l.receivedQuantity).gte(l.orderedQuantity));
    const anyReceived = refreshedLines.some((l) => new Prisma.Decimal(l.receivedQuantity).gt(0));
    const newStatus = fullyReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status;
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: newStatus } });

    return tx.goodsReceipt.findUnique({ where: { id: receipt.id }, include: receiptInclude });
  });
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const where = {
    ...(query.purchaseOrderId && { purchaseOrderId: query.purchaseOrderId }),
    ...(query.warehouseId && { warehouseId: query.warehouseId }),
    ...((query.dateFrom || query.dateTo) && {
      receivedAt: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
  };

  const [receipts, total] = await Promise.all([
    prisma.goodsReceipt.findMany({ where, orderBy: { receivedAt: sortOrder }, skip, take, include: receiptInclude }),
    prisma.goodsReceipt.count({ where }),
  ]);

  return { receipts, meta: buildMeta({ page, limit, total }) };
}

async function getById(id) {
  const receipt = await prisma.goodsReceipt.findUnique({ where: { id }, include: receiptInclude });
  if (!receipt) throw new AppError(404, 'NOT_FOUND', 'Goods receipt not found');
  return receipt;
}

module.exports = { create, list, getById };
