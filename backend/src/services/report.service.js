const prisma = require('../utils/prisma');

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function inventoryReport(query) {
  const where = {
    status: 'ACTIVE',
    ...(query.categoryId && { categoryId: query.categoryId }),
  };

  const items = await prisma.item.findMany({
    where,
    include: {
      category: { select: { name: true } },
      inventory: {
        ...(query.warehouseId && { where: { warehouseId: query.warehouseId } }),
        include: { warehouse: { select: { name: true } } },
      },
    },
  });

  const rows = items.map((item) => {
    const totalStock = item.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
    const value = totalStock * Number(item.unitCost);
    return {
      itemCode: item.itemCode,
      name: item.name,
      category: item.category.name,
      unit: item.unit,
      totalStock,
      reorderLevel: Number(item.reorderLevel),
      stockStatus: totalStock <= 0 ? 'OUT_OF_STOCK' : totalStock <= Number(item.reorderLevel) ? 'LOW_STOCK' : 'NORMAL',
      unitCost: Number(item.unitCost),
      totalValue: value,
      warehouses: item.inventory.map((inv) => `${inv.warehouse.name}: ${inv.quantity}`).join('; '),
    };
  });

  const summary = {
    totalItems: rows.length,
    totalValue: rows.reduce((sum, r) => sum + r.totalValue, 0),
    lowStockCount: rows.filter((r) => r.stockStatus === 'LOW_STOCK').length,
    outOfStockCount: rows.filter((r) => r.stockStatus === 'OUT_OF_STOCK').length,
  };

  return { rows, summary };
}

async function purchaseReport(query) {
  const where = {
    ...(query.supplierId && { supplierId: query.supplierId }),
    ...(query.status && { status: query.status }),
    ...((query.dateFrom || query.dateTo) && {
      orderDate: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
  };

  const orders = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { orderDate: 'desc' },
    include: { supplier: { select: { name: true } } },
  });

  const rows = orders.map((po) => ({
    poNumber: po.poNumber,
    supplier: po.supplier.name,
    orderDate: po.orderDate.toISOString().slice(0, 10),
    status: po.status,
    totalAmount: Number(po.totalAmount),
  }));

  const bySupplier = new Map();
  const byMonth = new Map();
  let pendingCount = 0;
  for (const po of orders) {
    const supplierName = po.supplier.name;
    bySupplier.set(supplierName, (bySupplier.get(supplierName) || 0) + Number(po.totalAmount));
    const key = monthKey(po.orderDate);
    byMonth.set(key, (byMonth.get(key) || 0) + Number(po.totalAmount));
    if (['PENDING', 'APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) pendingCount += 1;
  }

  return {
    rows,
    summary: {
      totalOrders: rows.length,
      totalAmount: rows.reduce((sum, r) => sum + r.totalAmount, 0),
      pendingCount,
      bySupplier: [...bySupplier.entries()].map(([supplier, totalAmount]) => ({ supplier, totalAmount })),
      byMonth: [...byMonth.entries()].sort().map(([month, totalAmount]) => ({ month, totalAmount })),
    },
  };
}

async function consumptionReport(query) {
  const where = {
    ...(query.itemId && { itemId: query.itemId }),
    ...(query.warehouseId && { warehouseId: query.warehouseId }),
    ...(query.productionBatchId && { productionBatchId: query.productionBatchId }),
    ...((query.dateFrom || query.dateTo) && {
      createdAt: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
  };

  const consumptions = await prisma.productionConsumption.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      item: { select: { name: true, unit: true } },
      warehouse: { select: { name: true } },
      productionBatch: { select: { batchNumber: true, product: true } },
    },
  });

  const rows = consumptions.map((c) => ({
    date: c.createdAt.toISOString().slice(0, 10),
    batchNumber: c.productionBatch.batchNumber,
    product: c.productionBatch.product,
    item: c.item.name,
    warehouse: c.warehouse.name,
    quantityConsumed: Number(c.quantityConsumed),
    unit: c.item.unit,
    department: c.department || '',
  }));

  const byDepartment = new Map();
  const byItem = new Map();
  const byMonth = new Map();
  for (const c of consumptions) {
    const dept = c.department || 'Unspecified';
    byDepartment.set(dept, (byDepartment.get(dept) || 0) + Number(c.quantityConsumed));
    byItem.set(c.item.name, (byItem.get(c.item.name) || 0) + Number(c.quantityConsumed));
    const key = monthKey(c.createdAt);
    byMonth.set(key, (byMonth.get(key) || 0) + Number(c.quantityConsumed));
  }

  return {
    rows,
    summary: {
      totalRecords: rows.length,
      totalQuantity: rows.reduce((sum, r) => sum + r.quantityConsumed, 0),
      byDepartment: [...byDepartment.entries()].map(([department, quantity]) => ({ department, quantity })),
      byItem: [...byItem.entries()].map(([item, quantity]) => ({ item, quantity })).sort((a, b) => b.quantity - a.quantity),
      byMonth: [...byMonth.entries()].sort().map(([month, quantity]) => ({ month, quantity })),
    },
  };
}

async function stockMovementReport(query) {
  const where = {
    ...(query.itemId && { itemId: query.itemId }),
    ...(query.warehouseId && { warehouseId: query.warehouseId }),
    ...(query.type && { type: query.type }),
    ...((query.dateFrom || query.dateTo) && {
      createdAt: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
  };

  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      item: { select: { name: true, unit: true } },
      warehouse: { select: { name: true } },
      user: { select: { name: true } },
    },
  });

  const rows = movements.map((m) => ({
    date: m.createdAt.toISOString().slice(0, 19).replace('T', ' '),
    item: m.item.name,
    warehouse: m.warehouse.name,
    type: m.type,
    quantity: Number(m.quantity),
    unit: m.item.unit,
    previousQuantity: Number(m.previousQuantity),
    newQuantity: Number(m.newQuantity),
    referenceType: m.referenceType,
    referenceNumber: m.referenceNumber || '',
    performedBy: m.user.name,
  }));

  const byType = new Map();
  for (const m of movements) {
    byType.set(m.type, (byType.get(m.type) || 0) + Number(m.quantity));
  }

  return {
    rows,
    summary: {
      totalMovements: rows.length,
      byType: [...byType.entries()].map(([type, quantity]) => ({ type, quantity })),
    },
  };
}

module.exports = { inventoryReport, purchaseReport, consumptionReport, stockMovementReport };
