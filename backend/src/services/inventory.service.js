/**
 * Read-only views over the Inventory table. Nothing here ever writes a quantity —
 * that only ever happens through utils/stockService.applyMovement, so every
 * number shown here is guaranteed to be backed by a StockMovement ledger entry.
 */
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

const SORTABLE = ['quantity', 'itemName', 'warehouseName', 'stockValue'];

function classify(quantity, reorderLevel) {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity <= reorderLevel) return 'LOW_STOCK';
  return 'NORMAL';
}

async function list(query) {
  const { page, limit } = parsePagination(query);
  const sortBy = SORTABLE.includes(query.sortBy) ? query.sortBy : 'itemName';
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

  const where = {
    ...(query.warehouseId && { warehouseId: query.warehouseId }),
    item: {
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { itemCode: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    },
  };

  const rows = await prisma.inventory.findMany({
    where,
    include: {
      item: { select: { id: true, itemCode: true, name: true, unit: true, reorderLevel: true, unitCost: true, category: { select: { id: true, name: true } } } },
      warehouse: { select: { id: true, name: true } },
    },
  });

  let enriched = rows.map((row) => {
    const quantity = Number(row.quantity);
    const reorderLevel = Number(row.item.reorderLevel);
    return {
      itemId: row.item.id,
      itemCode: row.item.itemCode,
      itemName: row.item.name,
      category: row.item.category,
      unit: row.item.unit,
      warehouseId: row.warehouse.id,
      warehouseName: row.warehouse.name,
      quantity,
      stockStatus: classify(quantity, reorderLevel),
      stockValue: quantity * Number(row.item.unitCost),
      updatedAt: row.updatedAt,
    };
  });

  if (query.stockStatus) {
    enriched = enriched.filter((r) => r.stockStatus === query.stockStatus);
  }

  enriched.sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    if (typeof av === 'string') return av.localeCompare(bv) * sortOrder;
    return (av - bv) * sortOrder;
  });

  const total = enriched.length;
  const start = (page - 1) * limit;
  const pageRows = enriched.slice(start, start + limit);

  return { inventory: pageRows, meta: buildMeta({ page, limit, total }) };
}

async function getByItem(itemId) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, itemCode: true, name: true, unit: true, reorderLevel: true, unitCost: true, category: { select: { id: true, name: true } } },
  });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Item not found');

  const rows = await prisma.inventory.findMany({
    where: { itemId },
    include: { warehouse: { select: { id: true, name: true, location: true } } },
    orderBy: { warehouse: { name: 'asc' } },
  });

  const byWarehouse = rows.map((row) => ({
    warehouse: row.warehouse,
    quantity: Number(row.quantity),
    stockValue: Number(row.quantity) * Number(item.unitCost),
    updatedAt: row.updatedAt,
  }));

  const totalStock = byWarehouse.reduce((sum, r) => sum + r.quantity, 0);

  return {
    item: { id: item.id, itemCode: item.itemCode, name: item.name, unit: item.unit, category: item.category },
    totalStock,
    stockStatus: classify(totalStock, Number(item.reorderLevel)),
    totalValue: totalStock * Number(item.unitCost),
    byWarehouse,
  };
}

module.exports = { list, getByItem };
