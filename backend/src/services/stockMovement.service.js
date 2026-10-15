/**
 * Read-only access to the StockMovement ledger. Rows are written exclusively by
 * utils/stockService.applyMovement and are never updated or deleted here —
 * the ledger is append-only by design (business rule: movements are immutable).
 */
const prisma = require('../utils/prisma');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query, { defaultLimit: 25, maxLimit: 200 });
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const where = {
    ...(query.itemId && { itemId: query.itemId }),
    ...(query.warehouseId && { warehouseId: query.warehouseId }),
    ...(query.type && { type: query.type }),
    ...(query.referenceType && { referenceType: query.referenceType }),
    ...((query.dateFrom || query.dateTo) && {
      createdAt: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
  };

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: sortOrder },
      skip,
      take,
      include: {
        item: { select: { id: true, itemCode: true, name: true, unit: true } },
        warehouse: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { movements, meta: buildMeta({ page, limit, total }) };
}

module.exports = { list };
