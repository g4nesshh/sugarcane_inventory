/**
 * Recording consumption against a batch deducts stock immediately (no approval
 * gate, per spec) — one applyMovement call per line inside a transaction, which
 * is also where insufficient-stock is caught.
 */
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { applyMovement, runInTransaction } = require('../utils/stockService');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

async function assertLinesValid(items) {
  const itemIds = [...new Set(items.map((i) => i.itemId))];
  const warehouseIds = [...new Set(items.map((i) => i.warehouseId))];

  const [foundItems, foundWarehouses] = await Promise.all([
    prisma.item.findMany({ where: { id: { in: itemIds } } }),
    prisma.warehouse.findMany({ where: { id: { in: warehouseIds } } }),
  ]);

  if (foundItems.length !== itemIds.length) throw new AppError(400, 'INVALID_ITEM', 'One or more selected items do not exist');
  const inactiveItem = foundItems.find((i) => i.status !== 'ACTIVE');
  if (inactiveItem) throw new AppError(400, 'ITEM_INACTIVE', `Item "${inactiveItem.name}" is not active`);

  if (foundWarehouses.length !== warehouseIds.length) {
    throw new AppError(400, 'INVALID_WAREHOUSE', 'One or more selected warehouses do not exist');
  }
  const inactiveWarehouse = foundWarehouses.find((w) => w.status !== 'ACTIVE');
  if (inactiveWarehouse) throw new AppError(400, 'WAREHOUSE_INACTIVE', `Warehouse "${inactiveWarehouse.name}" is not active`);
}

const consumptionInclude = {
  item: { select: { id: true, itemCode: true, name: true, unit: true } },
  warehouse: { select: { id: true, name: true } },
  productionBatch: { select: { id: true, batchNumber: true, product: true, status: true } },
};

async function create(data, userId) {
  const batch = await prisma.productionBatch.findUnique({ where: { id: data.productionBatchId } });
  if (!batch) throw new AppError(400, 'INVALID_PRODUCTION_BATCH', 'Production batch does not exist');
  if (batch.status === 'COMPLETED') {
    throw new AppError(409, 'BATCH_COMPLETED', 'Cannot record consumption against a completed batch');
  }
  await assertLinesValid(data.items);

  return runInTransaction(async (tx) => {
    const created = [];
    for (const line of data.items) {
      await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        type: 'PRODUCTION_CONSUMPTION',
        quantity: line.quantityConsumed,
        referenceType: 'PRODUCTION_CONSUMPTION',
        referenceId: batch.id,
        referenceNumber: batch.batchNumber,
        userId,
        remarks: line.remarks || `Consumed for batch ${batch.batchNumber}`,
      });
      created.push(
        await tx.productionConsumption.create({
          data: {
            productionBatchId: batch.id,
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            quantityConsumed: line.quantityConsumed,
            department: line.department,
            remarks: line.remarks,
          },
          include: consumptionInclude,
        })
      );
    }

    // Recording consumption implies production has started.
    if (batch.status === 'PLANNED') {
      await tx.productionBatch.update({ where: { id: batch.id }, data: { status: 'IN_PROGRESS' } });
    }

    return created;
  });
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const where = {
    ...(query.productionBatchId && { productionBatchId: query.productionBatchId }),
    ...(query.itemId && { itemId: query.itemId }),
    ...(query.warehouseId && { warehouseId: query.warehouseId }),
  };

  const [consumptions, total] = await Promise.all([
    prisma.productionConsumption.findMany({ where, orderBy: { createdAt: sortOrder }, skip, take, include: consumptionInclude }),
    prisma.productionConsumption.count({ where }),
  ]);

  return { consumptions, meta: buildMeta({ page, limit, total }) };
}

module.exports = { create, list };
