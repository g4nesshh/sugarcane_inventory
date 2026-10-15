const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

async function generateBatchNumber() {
  const prefix = `BATCH-${new Date().toISOString().slice(0, 7).replace('-', '')}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const countThisMonth = await prisma.productionBatch.count({ where: { batchNumber: { startsWith: prefix } } });
    const candidate = `${prefix}-${String(countThisMonth + 1 + attempt).padStart(4, '0')}`;
    const exists = await prisma.productionBatch.findUnique({ where: { batchNumber: candidate } });
    if (!exists) return candidate;
  }
  throw new AppError(500, 'BATCH_NUMBER_GENERATION_FAILED', 'Could not generate a unique batch number, please retry');
}

async function create(data) {
  const batchNumber = await generateBatchNumber();
  return prisma.productionBatch.create({
    data: {
      batchNumber,
      product: data.product,
      productionDate: data.productionDate ?? new Date(),
      quantityProduced: data.quantityProduced,
      status: 'PLANNED',
    },
  });
}

async function getById(id) {
  const batch = await prisma.productionBatch.findUnique({
    where: { id },
    include: {
      consumptions: {
        include: {
          item: { select: { id: true, itemCode: true, name: true, unit: true } },
          warehouse: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Production batch not found');
  return batch;
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const where = {
    ...(query.status && { status: query.status }),
    ...(query.search && {
      OR: [
        { product: { contains: query.search, mode: 'insensitive' } },
        { batchNumber: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
    ...((query.dateFrom || query.dateTo) && {
      productionDate: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
  };

  const [batches, total] = await Promise.all([
    prisma.productionBatch.findMany({ where, orderBy: { productionDate: sortOrder }, skip, take }),
    prisma.productionBatch.count({ where }),
  ]);

  return { batches, meta: buildMeta({ page, limit, total }) };
}

// Batch fields (product, output quantity, status) are plain records here — they never
// move stock themselves. Only consumption lines against a batch touch Inventory.
async function update(id, data) {
  await getById(id);
  return prisma.productionBatch.update({ where: { id }, data });
}

module.exports = { create, getById, list, update };
