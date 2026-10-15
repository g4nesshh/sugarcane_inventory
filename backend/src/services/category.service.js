const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { parsePagination, parseSort, buildMeta } = require('../utils/queryHelpers');

const SORTABLE = ['name', 'createdAt'];

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const orderBy = parseSort(query, SORTABLE, 'name');

  const where = {
    ...(query.status && { status: query.status }),
    ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
  };

  const [categories, total] = await Promise.all([
    prisma.category.findMany({ where, orderBy, skip, take, include: { _count: { select: { items: true } } } }),
    prisma.category.count({ where }),
  ]);

  return { categories, meta: buildMeta({ page, limit, total }) };
}

async function getById(id) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });
  if (!category) throw new AppError(404, 'NOT_FOUND', 'Category not found');
  return category;
}

async function create(data) {
  return prisma.category.create({ data });
}

async function update(id, data) {
  await getById(id);
  return prisma.category.update({ where: { id }, data });
}

// Soft-delete: categories may be referenced by historical items, so we deactivate
// rather than remove the row (business rule: preserve audit history).
async function deactivate(id) {
  await getById(id);
  return prisma.category.update({ where: { id }, data: { status: 'INACTIVE' } });
}

module.exports = { list, getById, create, update, deactivate };
