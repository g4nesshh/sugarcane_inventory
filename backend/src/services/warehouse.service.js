const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { parsePagination, parseSort, buildMeta } = require('../utils/queryHelpers');

const SORTABLE = ['name', 'location'];

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const orderBy = parseSort(query, SORTABLE, 'name');

  const where = {
    ...(query.status && { status: query.status }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { location: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [warehouses, total] = await Promise.all([
    prisma.warehouse.findMany({ where, orderBy, skip, take }),
    prisma.warehouse.count({ where }),
  ]);

  return { warehouses, meta: buildMeta({ page, limit, total }) };
}

async function getById(id) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) throw new AppError(404, 'NOT_FOUND', 'Warehouse not found');
  return warehouse;
}

async function create(data) {
  return prisma.warehouse.create({ data });
}

async function update(id, data) {
  await getById(id);
  return prisma.warehouse.update({ where: { id }, data });
}

// Soft-delete: a warehouse may have historical stock movements against it.
async function deactivate(id) {
  await getById(id);
  const stock = await prisma.inventory.aggregate({
    where: { warehouseId: id },
    _sum: { quantity: true },
  });
  if (stock._sum.quantity && Number(stock._sum.quantity) > 0) {
    throw new AppError(409, 'WAREHOUSE_HAS_STOCK', 'Cannot deactivate a warehouse that still holds stock');
  }
  return prisma.warehouse.update({ where: { id }, data: { status: 'INACTIVE' } });
}

module.exports = { list, getById, create, update, deactivate };
