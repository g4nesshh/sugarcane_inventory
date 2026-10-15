const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

const SORTABLE = ['name', 'itemCode', 'unitCost', 'createdAt', 'totalStock'];

function classifyStock(totalStock, item) {
  if (totalStock <= 0) return 'OUT_OF_STOCK';
  if (totalStock <= Number(item.reorderLevel)) return 'LOW_STOCK';
  return 'NORMAL';
}

// Stock totals and the resulting status/low-stock filters are computed values,
// not plain columns, so filtering/sorting on them happens after the fetch rather
// than in the Prisma `where`/`orderBy`. Fine at this catalog's scale (hundreds of
// SKUs); a very large catalog would push this into a raw aggregate query instead.
async function list(query) {
  const { page, limit } = parsePagination(query);
  const sortBy = SORTABLE.includes(query.sortBy) ? query.sortBy : 'name';
  const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

  const where = {
    ...(query.status && { status: query.status }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { itemCode: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const items = await prisma.item.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      inventory: query.warehouseId
        ? { where: { warehouseId: query.warehouseId }, include: { warehouse: { select: { id: true, name: true } } } }
        : { include: { warehouse: { select: { id: true, name: true } } } },
    },
  });

  let enriched = items.map((item) => {
    const totalStock = item.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
    return {
      ...item,
      totalStock,
      stockStatus: classifyStock(totalStock, item),
      stockValue: totalStock * Number(item.unitCost),
    };
  });

  if (query.warehouseId) {
    // Only meaningful in this warehouse's context; items with no row there have zero stock there.
    enriched = enriched.filter((i) => i.inventory.length > 0 || true);
  }
  if (query.stockStatus) {
    enriched = enriched.filter((i) => i.stockStatus === query.stockStatus);
  }

  enriched.sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    if (typeof av === 'string') return av.localeCompare(bv) * sortOrder;
    return (av - bv) * sortOrder;
  });

  const total = enriched.length;
  const start = (page - 1) * limit;
  const pageItems = enriched.slice(start, start + limit);

  return { items: pageItems, meta: buildMeta({ page, limit, total }) };
}

async function getById(id) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      category: true,
      supplier: true,
      inventory: { include: { warehouse: { select: { id: true, name: true } } } },
    },
  });
  if (!item) throw new AppError(404, 'NOT_FOUND', 'Item not found');
  const totalStock = item.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
  return { ...item, totalStock, stockStatus: classifyStock(totalStock, item), stockValue: totalStock * Number(item.unitCost) };
}

async function assertCategoryExists(categoryId) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError(400, 'INVALID_CATEGORY', 'Selected category does not exist');
}

async function assertSupplierExists(supplierId) {
  if (supplierId == null) return;
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new AppError(400, 'INVALID_SUPPLIER', 'Selected supplier does not exist');
}

async function create(data) {
  await assertCategoryExists(data.categoryId);
  await assertSupplierExists(data.supplierId);
  return prisma.item.create({ data });
}

async function update(id, data) {
  await getById(id);
  if (data.categoryId) await assertCategoryExists(data.categoryId);
  if (data.supplierId) await assertSupplierExists(data.supplierId);
  return prisma.item.update({ where: { id }, data });
}

// Soft-delete/deactivate: items may be referenced by historical stock movements,
// purchase order lines, etc. — never hard-delete a master record like this.
async function deactivate(id) {
  await getById(id);
  return prisma.item.update({ where: { id }, data: { status: 'INACTIVE' } });
}

module.exports = { list, getById, create, update, deactivate };
