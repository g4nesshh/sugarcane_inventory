/**
 * Shared setup for integration tests. These hit the real Express app and a real
 * (test) Postgres database through Prisma — they need DATABASE_URL pointing at a
 * migrated test database to run (see README "Running the tests").
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const prisma = require('../../src/utils/prisma');
const { applyMovement, runInTransaction } = require('../../src/utils/stockService');

const DEFAULT_PASSWORD = 'Password@123';
let seq = 0;
const unique = (prefix) => `${prefix}-${Date.now()}-${seq++}`;

// Deletes every row, children before parents, so the next test starts from a
// genuinely empty database rather than relying on unique names alone.
async function resetDb() {
  await prisma.stockMovement.deleteMany();
  await prisma.goodsReceiptItem.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.stockIssueItem.deleteMany();
  await prisma.stockTransferItem.deleteMany();
  await prisma.productionConsumption.deleteMany();
  await prisma.stockAdjustment.deleteMany();
  await prisma.sugarcaneReceipt.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockIssue.deleteMany();
  await prisma.stockTransfer.deleteMany();
  await prisma.productionBatch.deleteMany();
  await prisma.item.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser({ role, email, password = DEFAULT_PASSWORD, status = 'ACTIVE' }) {
  const passwordHash = await bcrypt.hash(password, 4); // low cost factor — tests don't need production hashing cost
  return prisma.user.create({ data: { name: role, email, passwordHash, role, status } });
}

async function loginAs(email, password = DEFAULT_PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`loginAs(${email}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.token;
}

const createCategory = (overrides = {}) => prisma.category.create({ data: { name: unique('Category'), ...overrides } });
const createWarehouse = (overrides = {}) => prisma.warehouse.create({ data: { name: unique('Warehouse'), ...overrides } });
const createSupplier = (overrides = {}) => prisma.supplier.create({ data: { name: unique('Supplier'), ...overrides } });

const createItem = ({ categoryId, ...overrides }) =>
  prisma.item.create({
    data: { itemCode: unique('ITEM'), name: unique('Item'), unit: 'KG', categoryId, reorderLevel: 10, unitCost: 5, ...overrides },
  });

// Seeds opening stock through the real stockService — not a shortcut, the same
// function every actual stock-moving endpoint calls — so fixtures stay honest.
const seedStock = (itemId, warehouseId, quantity, userId) =>
  runInTransaction((tx) =>
    applyMovement(tx, { itemId, warehouseId, type: 'ADJUSTMENT_IN', quantity, referenceType: 'TEST_SEED', userId })
  );

// Drives a PO through DRAFT -> PENDING -> APPROVED via the real API so tests
// exercise the actual transition guard rather than writing the status directly.
async function createApprovedPO(token, { supplierId, items }) {
  const createRes = await request(app).post('/api/purchases').set('Authorization', `Bearer ${token}`).send({ supplierId, items });
  if (createRes.status !== 201) throw new Error(`PO create failed: ${JSON.stringify(createRes.body)}`);
  const po = createRes.body.data.purchaseOrder;

  const toPending = await request(app).put(`/api/purchases/${po.id}`).set('Authorization', `Bearer ${token}`).send({ status: 'PENDING' });
  if (toPending.status !== 200) throw new Error(`PO -> PENDING failed: ${JSON.stringify(toPending.body)}`);

  const toApproved = await request(app).put(`/api/purchases/${po.id}`).set('Authorization', `Bearer ${token}`).send({ status: 'APPROVED' });
  if (toApproved.status !== 200) throw new Error(`PO -> APPROVED failed: ${JSON.stringify(toApproved.body)}`);

  return toApproved.body.data.purchaseOrder;
}

module.exports = {
  app, prisma, resetDb, createUser, loginAs, createCategory, createWarehouse, createSupplier, createItem, seedStock, createApprovedPO,
  DEFAULT_PASSWORD,
};
