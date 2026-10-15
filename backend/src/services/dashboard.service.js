const prisma = require('../utils/prisma');
const { INCOMING } = require('../utils/stockService');

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function getSummary() {
  const today = startOfDay(new Date());
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); // current month + 5 back = 6 months
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [items, inventoryRows, pendingPurchaseOrders, todaysReceipts, todaysIssueMovements] = await Promise.all([
    prisma.item.findMany({ where: { status: 'ACTIVE' }, select: { id: true, reorderLevel: true, unitCost: true, categoryId: true } }),
    prisma.inventory.findMany({
      include: { item: { select: { id: true, unitCost: true, categoryId: true, category: { select: { name: true } } } } },
    }),
    prisma.purchaseOrder.count({ where: { status: { in: ['PENDING', 'APPROVED', 'PARTIALLY_RECEIVED'] } } }),
    prisma.goodsReceipt.count({ where: { receivedAt: { gte: today } } }),
    prisma.stockMovement.count({ where: { type: 'STOCK_ISSUE', createdAt: { gte: today } } }),
  ]);

  // Stock per item, summed across warehouses.
  const stockByItem = new Map();
  for (const row of inventoryRows) {
    stockByItem.set(row.itemId, (stockByItem.get(row.itemId) || 0) + Number(row.quantity));
  }

  let totalInventoryValue = 0;
  let lowStockItems = 0;
  let outOfStockItems = 0;
  for (const item of items) {
    const stock = stockByItem.get(item.id) || 0;
    totalInventoryValue += stock * Number(item.unitCost);
    if (stock <= 0) outOfStockItems += 1;
    else if (stock <= Number(item.reorderLevel)) lowStockItems += 1;
  }

  // Inventory value by category, from the same rows already fetched.
  const valueByCategory = new Map();
  for (const row of inventoryRows) {
    const categoryName = row.item.category?.name || 'Uncategorized';
    const value = Number(row.quantity) * Number(row.item.unitCost);
    valueByCategory.set(categoryName, (valueByCategory.get(categoryName) || 0) + value);
  }

  // Sugarcane stock: sum of inventory rows whose item category is literally "Sugarcane".
  const currentSugarcaneStock = inventoryRows
    .filter((r) => r.item.category?.name === 'Sugarcane')
    .reduce((sum, r) => sum + Number(r.quantity), 0);

  const [purchaseOrders, consumptionMovements, recentPurchases, recentReceipts, recentIssues, recentAdjustments] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { orderDate: { gte: sixMonthsAgo } },
      select: { orderDate: true, totalAmount: true },
    }),
    prisma.stockMovement.findMany({
      where: { type: 'PRODUCTION_CONSUMPTION', createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, quantity: true, itemId: true, item: { select: { name: true } } },
    }),
    prisma.purchaseOrder.findMany({
      orderBy: { orderDate: 'desc' },
      take: 5,
      select: { id: true, poNumber: true, status: true, totalAmount: true, orderDate: true, supplier: { select: { name: true } } },
    }),
    prisma.goodsReceipt.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 5,
      select: { id: true, receiptNumber: true, receivedAt: true, warehouse: { select: { name: true } } },
    }),
    prisma.stockIssue.findMany({
      orderBy: { issueDate: 'desc' },
      take: 5,
      select: { id: true, issueNumber: true, department: true, status: true, issueDate: true },
    }),
    prisma.stockAdjustment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, adjustmentNumber: true, status: true, createdAt: true, item: { select: { name: true } } },
    }),
  ]);

  const monthlyPurchases = new Map();
  for (const po of purchaseOrders) {
    const key = monthKey(po.orderDate);
    monthlyPurchases.set(key, (monthlyPurchases.get(key) || 0) + Number(po.totalAmount));
  }

  const monthlyConsumption = new Map();
  const consumptionByItem = new Map();
  for (const m of consumptionMovements) {
    const key = monthKey(m.createdAt);
    monthlyConsumption.set(key, (monthlyConsumption.get(key) || 0) + Number(m.quantity));
    if (m.createdAt >= thirtyDaysAgo) {
      const current = consumptionByItem.get(m.itemId) || { name: m.item.name, quantity: 0 };
      current.quantity += Number(m.quantity);
      consumptionByItem.set(m.itemId, current);
    }
  }

  const topConsumedMaterials = [...consumptionByItem.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  return {
    kpis: {
      totalInventoryItems: items.length,
      totalInventoryValue,
      lowStockItems,
      outOfStockItems,
      pendingPurchaseOrders,
      todaysReceipts,
      todaysIssues: todaysIssueMovements,
      currentSugarcaneStock,
    },
    charts: {
      inventoryValueByCategory: [...valueByCategory.entries()].map(([category, value]) => ({ category, value })),
      monthlyPurchases: [...monthlyPurchases.entries()].sort().map(([month, totalAmount]) => ({ month, totalAmount })),
      monthlyConsumption: [...monthlyConsumption.entries()].sort().map(([month, totalQuantity]) => ({ month, totalQuantity })),
      topConsumedMaterials,
    },
    recentActivity: {
      purchases: recentPurchases,
      receipts: recentReceipts,
      issues: recentIssues,
      adjustments: recentAdjustments,
    },
  };
}

async function getStockMovementSeries(days = 30) {
  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  const movements = await prisma.stockMovement.findMany({
    where: { createdAt: { gte: start } },
    select: { createdAt: true, type: true, quantity: true },
  });

  const byDay = new Map();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, stockIn: 0, stockOut: 0 });
  }

  for (const m of movements) {
    const key = new Date(m.createdAt).toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (!bucket) continue; // outside range due to timezone/day-boundary edge cases
    if (INCOMING.has(m.type)) bucket.stockIn += Number(m.quantity);
    else bucket.stockOut += Number(m.quantity);
  }

  return [...byDay.values()];
}

async function getLowStock(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  const items = await prisma.item.findMany({
    where: { status: 'ACTIVE' },
    include: { category: { select: { id: true, name: true } }, inventory: true },
  });

  const withStock = items
    .map((item) => {
      const totalStock = item.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
      return {
        id: item.id,
        itemCode: item.itemCode,
        name: item.name,
        unit: item.unit,
        category: item.category,
        reorderLevel: Number(item.reorderLevel),
        totalStock,
        stockStatus: totalStock <= 0 ? 'OUT_OF_STOCK' : totalStock <= Number(item.reorderLevel) ? 'LOW_STOCK' : 'NORMAL',
      };
    })
    .filter((i) => i.stockStatus !== 'NORMAL')
    .sort((a, b) => a.totalStock - b.totalStock);

  const total = withStock.length;
  const start = (page - 1) * limit;
  return { items: withStock.slice(start, start + limit), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

module.exports = { getSummary, getStockMovementSeries, getLowStock };
