const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { parsePagination, parseSort, buildMeta } = require('../utils/queryHelpers');

const SORTABLE = ['name', 'supplierType', 'createdAt'];

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const orderBy = parseSort(query, SORTABLE, 'name');

  const where = {
    ...(query.status && { status: query.status }),
    ...(query.supplierType && { supplierType: query.supplierType }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { contactPerson: { contains: query.search, mode: 'insensitive' } },
        { gstNumber: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ where, orderBy, skip, take }),
    prisma.supplier.count({ where }),
  ]);

  return { suppliers, meta: buildMeta({ page, limit, total }) };
}

async function getById(id) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) throw new AppError(404, 'NOT_FOUND', 'Supplier not found');
  return supplier;
}

async function create(data) {
  const { email, ...rest } = data;
  return prisma.supplier.create({ data: { ...rest, email: email || null } });
}

async function update(id, data) {
  await getById(id);
  const { email, ...rest } = data;
  return prisma.supplier.update({ where: { id }, data: { ...rest, ...(email !== undefined && { email: email || null }) } });
}

// Soft-delete: purchase orders and items reference suppliers historically.
async function deactivate(id) {
  await getById(id);
  return prisma.supplier.update({ where: { id }, data: { status: 'INACTIVE' } });
}

module.exports = { list, getById, create, update, deactivate };
