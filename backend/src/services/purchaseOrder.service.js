const { Prisma } = require('@prisma/client');
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

const SORTABLE = ['poNumber', 'orderDate', 'totalAmount', 'status'];

// PARTIALLY_RECEIVED / RECEIVED are set only by the goods-receipt workflow (Phase 6).
const TRANSITIONS = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'CANCELLED', 'DRAFT'],
  APPROVED: ['CANCELLED'],
  PARTIALLY_RECEIVED: [],
  RECEIVED: [],
  CANCELLED: [],
};

async function generatePoNumber(tx) {
  const prefix = `PO-${new Date().toISOString().slice(0, 7).replace('-', '')}`; // PO-YYYYMM
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const countThisMonth = await tx.purchaseOrder.count({ where: { poNumber: { startsWith: prefix } } });
    const candidate = `${prefix}-${String(countThisMonth + 1 + attempt).padStart(4, '0')}`;
    const exists = await tx.purchaseOrder.findUnique({ where: { poNumber: candidate } });
    if (!exists) return candidate;
  }
  throw new AppError(500, 'PO_NUMBER_GENERATION_FAILED', 'Could not generate a unique PO number, please retry');
}

function computeTotal(items, tax, discount) {
  const subtotal = items.reduce(
    (sum, i) => sum.plus(new Prisma.Decimal(i.orderedQuantity).times(i.unitPrice)),
    new Prisma.Decimal(0)
  );
  return subtotal.plus(tax).minus(discount);
}

async function assertSupplierActive(supplierId) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new AppError(400, 'INVALID_SUPPLIER', 'Selected supplier does not exist');
  if (supplier.status !== 'ACTIVE') throw new AppError(400, 'SUPPLIER_INACTIVE', 'Selected supplier is not active');
}

async function assertItemsExist(items) {
  const ids = [...new Set(items.map((i) => i.itemId))];
  const found = await prisma.item.findMany({ where: { id: { in: ids } } });
  if (found.length !== ids.length) {
    throw new AppError(400, 'INVALID_ITEM', 'One or more selected items do not exist');
  }
  const inactive = found.find((i) => i.status !== 'ACTIVE');
  if (inactive) throw new AppError(400, 'ITEM_INACTIVE', `Item "${inactive.name}" is not active`);
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const sortBy = SORTABLE.includes(query.sortBy) ? query.sortBy : 'orderDate';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const where = {
    ...(query.supplierId && { supplierId: query.supplierId }),
    ...(query.status && { status: query.status }),
    ...(query.search && { poNumber: { contains: query.search, mode: 'insensitive' } }),
    ...((query.dateFrom || query.dateTo) && {
      orderDate: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
  };

  const [purchaseOrders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take,
      include: {
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { purchaseOrders, meta: buildMeta({ page, limit, total }) };
}

async function getById(id) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      creator: { select: { id: true, name: true } },
      items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true, unitCost: true } } } },
      receipts: { select: { id: true, receiptNumber: true, receivedAt: true, warehouseId: true } },
    },
  });
  if (!po) throw new AppError(404, 'NOT_FOUND', 'Purchase order not found');
  return po;
}

async function create(data, userId) {
  await assertSupplierActive(data.supplierId);
  await assertItemsExist(data.items);
  const totalAmount = computeTotal(data.items, data.tax, data.discount);

  return prisma.$transaction(async (tx) => {
    const poNumber = await generatePoNumber(tx);
    return tx.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: data.supplierId,
        expectedDate: data.expectedDate,
        tax: data.tax,
        discount: data.discount,
        notes: data.notes,
        totalAmount,
        createdBy: userId,
        status: 'DRAFT',
        items: {
          create: data.items.map((i) => ({
            itemId: i.itemId,
            orderedQuantity: i.orderedQuantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
      include: {
        items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
        supplier: true,
      },
    });
  });
}

async function update(id, data) {
  const existing = await getById(id);

  if (data.items && existing.status !== 'DRAFT') {
    throw new AppError(409, 'PO_NOT_EDITABLE', 'Line items can only be changed while the purchase order is in Draft');
  }
  if (data.status && !TRANSITIONS[existing.status].includes(data.status)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Cannot move a purchase order from ${existing.status} to ${data.status}`
    );
  }
  if (data.supplierId) await assertSupplierActive(data.supplierId);
  if (data.items) await assertItemsExist(data.items);

  const effectiveItems = data.items
    ? data.items
    : existing.items.map((i) => ({
        itemId: i.itemId,
        orderedQuantity: Number(i.orderedQuantity),
        unitPrice: Number(i.unitPrice),
      }));
  const tax = data.tax ?? Number(existing.tax);
  const discount = data.discount ?? Number(existing.discount);
  const recomputeTotal = data.items !== undefined || data.tax !== undefined || data.discount !== undefined;

  return prisma.$transaction(async (tx) => {
    if (data.items) {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    }

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        ...(data.supplierId && { supplierId: data.supplierId }),
        ...(data.expectedDate !== undefined && { expectedDate: data.expectedDate }),
        ...(data.tax !== undefined && { tax: data.tax }),
        ...(data.discount !== undefined && { discount: data.discount }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status && { status: data.status }),
        ...(recomputeTotal && { totalAmount: computeTotal(effectiveItems, tax, discount) }),
        ...(data.items && {
          items: {
            create: data.items.map((i) => ({ itemId: i.itemId, orderedQuantity: i.orderedQuantity, unitPrice: i.unitPrice })),
          },
        }),
      },
      include: {
        items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
        supplier: true,
      },
    });
  });
}

module.exports = { list, getById, create, update };
