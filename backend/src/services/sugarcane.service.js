/**
 * Sugarcane receipts are a specialized, direct-from-farmer intake: weighed at the
 * gate, not tied to a formal Purchase Order. A receipt increases stock immediately;
 * crushing later decreases it. Both go through stockService.applyMovement so they
 * land in the same ledger as every other movement.
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { applyMovement, runInTransaction } = require('../utils/stockService');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

const receiptInclude = {
  supplier: { select: { id: true, name: true } },
  item: { select: { id: true, itemCode: true, name: true, unit: true } },
  warehouse: { select: { id: true, name: true } },
};

async function assertSupplierActive(supplierId) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new AppError(400, 'INVALID_SUPPLIER', 'Supplier does not exist');
  if (supplier.status !== 'ACTIVE') throw new AppError(400, 'SUPPLIER_INACTIVE', 'Supplier is not active');
}

async function assertItemActive(itemId) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError(400, 'INVALID_ITEM', 'Item does not exist');
  if (item.status !== 'ACTIVE') throw new AppError(400, 'ITEM_INACTIVE', `Item "${item.name}" is not active`);
  return item;
}

async function assertWarehouseActive(warehouseId) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new AppError(400, 'INVALID_WAREHOUSE', 'Warehouse does not exist');
  if (warehouse.status !== 'ACTIVE') throw new AppError(400, 'WAREHOUSE_INACTIVE', 'Warehouse is not active');
  return warehouse;
}

async function create(data, userId) {
  await assertSupplierActive(data.supplierId);
  await assertItemActive(data.itemId);
  await assertWarehouseActive(data.warehouseId);

  const netWeight = new Prisma.Decimal(data.grossWeight).minus(data.tareWeight);
  if (netWeight.lte(0)) throw new AppError(400, 'INVALID_WEIGHT', 'Net weight must be greater than zero');

  return runInTransaction(async (tx) => {
    const receipt = await tx.sugarcaneReceipt.create({
      data: {
        supplierId: data.supplierId,
        itemId: data.itemId,
        warehouseId: data.warehouseId,
        vehicleNumber: data.vehicleNumber,
        grossWeight: data.grossWeight,
        tareWeight: data.tareWeight,
        netWeight,
        quality: data.quality,
        unloadingLocation: data.unloadingLocation,
        arrivalDate: data.arrivalDate ?? new Date(),
        status: 'RECEIVED',
      },
    });

    await applyMovement(tx, {
      itemId: data.itemId,
      warehouseId: data.warehouseId,
      type: 'PURCHASE_RECEIPT',
      quantity: netWeight,
      referenceType: 'SUGARCANE_RECEIPT',
      referenceId: receipt.id,
      referenceNumber: `CANE-${receipt.id}`,
      userId,
      remarks: `Cane received from supplier #${data.supplierId}, vehicle ${data.vehicleNumber}`,
    });

    return tx.sugarcaneReceipt.findUnique({ where: { id: receipt.id }, include: receiptInclude });
  });
}

async function getById(id) {
  const receipt = await prisma.sugarcaneReceipt.findUnique({ where: { id }, include: receiptInclude });
  if (!receipt) throw new AppError(404, 'NOT_FOUND', 'Sugarcane receipt not found');
  return receipt;
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const where = {
    ...(query.supplierId && { supplierId: query.supplierId }),
    ...(query.status && { status: query.status }),
    ...((query.dateFrom || query.dateTo) && {
      arrivalDate: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
  };

  const [receipts, total] = await Promise.all([
    prisma.sugarcaneReceipt.findMany({ where, orderBy: { arrivalDate: sortOrder }, skip, take, include: receiptInclude }),
    prisma.sugarcaneReceipt.count({ where }),
  ]);

  return { receipts, meta: buildMeta({ page, limit, total }) };
}

// Crushing consumes previously-received cane for this specific receipt record —
// capped at what that receipt actually delivered (its netWeight), tracked via
// crushedQuantity so a receipt can be crushed in several passes over time.
async function crush(id, data, userId) {
  const receipt = await getById(id);
  if (receipt.status === 'CRUSHED') {
    throw new AppError(409, 'ALREADY_CRUSHED', 'This receipt has already been fully crushed');
  }

  const remaining = new Prisma.Decimal(receipt.netWeight).minus(receipt.crushedQuantity);
  const requested = new Prisma.Decimal(data.quantity);
  if (requested.gt(remaining)) {
    throw new AppError(409, 'OVER_CRUSH', `Cannot crush ${data.quantity}; only ${remaining.toString()} remaining on this receipt`);
  }

  return runInTransaction(async (tx) => {
    await applyMovement(tx, {
      itemId: receipt.itemId,
      warehouseId: receipt.warehouseId,
      type: 'PRODUCTION_CONSUMPTION',
      quantity: data.quantity,
      referenceType: 'SUGARCANE_CRUSHING',
      referenceId: receipt.id,
      referenceNumber: `CANE-${receipt.id}`,
      userId,
      remarks: 'Sugarcane sent for crushing',
    });

    const newCrushed = new Prisma.Decimal(receipt.crushedQuantity).plus(data.quantity);
    const newStatus = newCrushed.gte(receipt.netWeight) ? 'CRUSHED' : 'PARTIALLY_CRUSHED';

    return tx.sugarcaneReceipt.update({
      where: { id },
      data: {
        crushedQuantity: newCrushed,
        status: newStatus,
        crushingDate: receipt.crushingDate ?? new Date(),
      },
      include: receiptInclude,
    });
  });
}

module.exports = { create, getById, list, crush };
