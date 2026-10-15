/**
 * Stock Issue: a request first, a stock movement only once approved.
 * Creating an issue never touches Inventory — only approve() does, via
 * stockService.applyMovement, which is also where "not enough stock" is caught.
 */
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const { applyMovement, runInTransaction } = require('../utils/stockService');
const { parsePagination, buildMeta } = require('../utils/queryHelpers');

async function generateIssueNumber(tx) {
  const prefix = `ISS-${new Date().toISOString().slice(0, 7).replace('-', '')}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const countThisMonth = await tx.stockIssue.count({ where: { issueNumber: { startsWith: prefix } } });
    const candidate = `${prefix}-${String(countThisMonth + 1 + attempt).padStart(4, '0')}`;
    const exists = await tx.stockIssue.findUnique({ where: { issueNumber: candidate } });
    if (!exists) return candidate;
  }
  throw new AppError(500, 'ISSUE_NUMBER_GENERATION_FAILED', 'Could not generate a unique issue number, please retry');
}

// StockIssueItem has an itemId and a warehouseId but no declared `warehouse` relation
// in the schema (only `item`), so warehouse names are attached in a second pass below.
const issueInclude = {
  requester: { select: { id: true, name: true } },
  approver: { select: { id: true, name: true } },
  items: { include: { item: { select: { id: true, itemCode: true, name: true, unit: true } } } },
};

async function attachWarehouseNames(issue) {
  const warehouseIds = [...new Set(issue.items.map((i) => i.warehouseId))];
  const warehouses = await prisma.warehouse.findMany({ where: { id: { in: warehouseIds } }, select: { id: true, name: true } });
  const byId = new Map(warehouses.map((w) => [w.id, w]));
  return {
    ...issue,
    items: issue.items.map((line) => ({ ...line, warehouse: byId.get(line.warehouseId) || null })),
  };
}

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

async function create(data, userId) {
  await assertLinesValid(data.items);

  const issue = await runInTransaction(async (tx) => {
    const issueNumber = await generateIssueNumber(tx);
    return tx.stockIssue.create({
      data: {
        issueNumber,
        department: data.department,
        purpose: data.purpose,
        remarks: data.remarks,
        requestedBy: userId,
        status: 'PENDING',
        items: { create: data.items.map((i) => ({ itemId: i.itemId, warehouseId: i.warehouseId, quantity: i.quantity })) },
      },
      include: issueInclude,
    });
  });

  return attachWarehouseNames(issue);
}

async function getRaw(id) {
  const issue = await prisma.stockIssue.findUnique({ where: { id }, include: issueInclude });
  if (!issue) throw new AppError(404, 'NOT_FOUND', 'Stock issue not found');
  return issue;
}

async function getById(id) {
  return attachWarehouseNames(await getRaw(id));
}

async function list(query) {
  const { page, limit, skip, take } = parsePagination(query);
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const where = {
    ...(query.department && { department: query.department }),
    ...(query.status && { status: query.status }),
    ...((query.dateFrom || query.dateTo) && {
      issueDate: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
  };

  const [issues, total] = await Promise.all([
    prisma.stockIssue.findMany({ where, orderBy: { issueDate: sortOrder }, skip, take, include: issueInclude }),
    prisma.stockIssue.count({ where }),
  ]);

  return { issues: await Promise.all(issues.map(attachWarehouseNames)), meta: buildMeta({ page, limit, total }) };
}

// Approving is the only thing that ever decreases stock for an issue. Each line's
// applyMovement call is where "not enough stock" gets caught, against live quantities.
async function approve(id, userId) {
  const existing = await getRaw(id);
  if (existing.status !== 'PENDING') {
    throw new AppError(409, 'ISSUE_NOT_PENDING', `Only a pending issue can be approved (current status: ${existing.status})`);
  }

  const updated = await runInTransaction(async (tx) => {
    for (const line of existing.items) {
      await applyMovement(tx, {
        itemId: line.itemId,
        warehouseId: line.warehouseId,
        type: 'STOCK_ISSUE',
        quantity: line.quantity,
        referenceType: 'STOCK_ISSUE',
        referenceId: existing.id,
        referenceNumber: existing.issueNumber,
        userId,
        remarks: `Issued to ${existing.department}`,
      });
    }
    return tx.stockIssue.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: userId },
      include: issueInclude,
    });
  });

  return attachWarehouseNames(updated);
}

async function reject(id, userId, remarks) {
  const existing = await getRaw(id);
  if (existing.status !== 'PENDING') {
    throw new AppError(409, 'ISSUE_NOT_PENDING', `Only a pending issue can be rejected (current status: ${existing.status})`);
  }
  const updated = await prisma.stockIssue.update({
    where: { id },
    data: { status: 'REJECTED', approvedBy: userId, ...(remarks && { remarks }) },
    include: issueInclude,
  });
  return attachWarehouseNames(updated);
}

module.exports = { create, list, getById, approve, reject };
