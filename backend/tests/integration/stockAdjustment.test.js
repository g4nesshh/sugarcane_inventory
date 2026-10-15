const request = require('supertest');
const { app, prisma, resetDb, createUser, loginAs, createCategory, createWarehouse, createItem, seedStock } = require('./helpers');

describe('Stock Adjustments', () => {
  let admin, adminToken, imToken, warehouse, item;

  beforeEach(async () => {
    await resetDb();
    admin = await createUser({ role: 'ADMIN', email: 'admin@test.local' });
    adminToken = await loginAs('admin@test.local');
    await createUser({ role: 'INVENTORY_MANAGER', email: 'im@test.local' });
    imToken = await loginAs('im@test.local');

    const category = await createCategory();
    warehouse = await createWarehouse();
    item = await createItem({ categoryId: category.id });
    await seedStock(item.id, warehouse.id, 80, admin.id);
  });

  afterAll(() => prisma.$disconnect());

  async function currentStock() {
    const res = await request(app).get(`/api/inventory/${item.id}`).set('Authorization', `Bearer ${adminToken}`);
    return res.body.data.totalStock;
  }

  test('creating an adjustment snapshots the system quantity and computes the difference, without touching stock', async () => {
    const res = await request(app)
      .post('/api/adjustments')
      .set('Authorization', `Bearer ${imToken}`)
      .send({ itemId: item.id, warehouseId: warehouse.id, physicalQuantity: 95, reason: 'PHYSICAL_DIFFERENCE' });

    expect(res.status).toBe(201);
    expect(Number(res.body.data.adjustment.systemQuantity)).toBe(80);
    expect(Number(res.body.data.adjustment.physicalQuantity)).toBe(95);
    expect(Number(res.body.data.adjustment.difference)).toBe(15);
    expect(res.body.data.adjustment.status).toBe('PENDING');

    expect(await currentStock()).toBe(80); // unaffected until approved
  });

  test('approving a positive-difference adjustment increases stock by exactly the difference', async () => {
    const createRes = await request(app)
      .post('/api/adjustments')
      .set('Authorization', `Bearer ${imToken}`)
      .send({ itemId: item.id, warehouseId: warehouse.id, physicalQuantity: 95, reason: 'PHYSICAL_DIFFERENCE' });
    const adjustment = createRes.body.data.adjustment;

    const approveRes = await request(app).put(`/api/adjustments/${adjustment.id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(await currentStock()).toBe(95);
  });

  test('approving a negative-difference adjustment decreases stock by exactly the difference', async () => {
    const createRes = await request(app)
      .post('/api/adjustments')
      .set('Authorization', `Bearer ${imToken}`)
      .send({ itemId: item.id, warehouseId: warehouse.id, physicalQuantity: 60, reason: 'DAMAGED' });
    const adjustment = createRes.body.data.adjustment;

    const approveRes = await request(app).put(`/api/adjustments/${adjustment.id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(await currentStock()).toBe(60);
  });

  test('a zero-difference adjustment approves with no stock movement recorded at all', async () => {
    const createRes = await request(app)
      .post('/api/adjustments')
      .set('Authorization', `Bearer ${imToken}`)
      .send({ itemId: item.id, warehouseId: warehouse.id, physicalQuantity: 80, reason: 'CORRECTION' });
    const adjustment = createRes.body.data.adjustment;
    expect(Number(adjustment.difference)).toBe(0);

    const approveRes = await request(app).put(`/api/adjustments/${adjustment.id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(await currentStock()).toBe(80);

    const ledgerRes = await request(app)
      .get('/api/stock-movements')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ referenceType: 'STOCK_ADJUSTMENT', itemId: item.id });
    expect(ledgerRes.body.data.movements).toHaveLength(0);
  });

  test('an INVENTORY_MANAGER can request an adjustment but cannot approve it (approveAdjustment is ADMIN-only)', async () => {
    const createRes = await request(app)
      .post('/api/adjustments')
      .set('Authorization', `Bearer ${imToken}`)
      .send({ itemId: item.id, warehouseId: warehouse.id, physicalQuantity: 95, reason: 'PHYSICAL_DIFFERENCE' });
    const adjustment = createRes.body.data.adjustment;

    const approveRes = await request(app).put(`/api/adjustments/${adjustment.id}/approve`).set('Authorization', `Bearer ${imToken}`);
    expect(approveRes.status).toBe(403);
  });

  test('cannot approve the same adjustment twice', async () => {
    const createRes = await request(app)
      .post('/api/adjustments')
      .set('Authorization', `Bearer ${imToken}`)
      .send({ itemId: item.id, warehouseId: warehouse.id, physicalQuantity: 95, reason: 'PHYSICAL_DIFFERENCE' });
    const adjustment = createRes.body.data.adjustment;

    await request(app).put(`/api/adjustments/${adjustment.id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    const secondApprove = await request(app).put(`/api/adjustments/${adjustment.id}/approve`).set('Authorization', `Bearer ${adminToken}`);

    expect(secondApprove.status).toBe(409);
    expect(secondApprove.body.error).toBe('ADJUSTMENT_NOT_PENDING');
    expect(await currentStock()).toBe(95); // not double-applied
  });
});
