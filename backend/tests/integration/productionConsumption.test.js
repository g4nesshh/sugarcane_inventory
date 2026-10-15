const request = require('supertest');
const { app, prisma, resetDb, createUser, loginAs, createCategory, createWarehouse, createItem, seedStock } = require('./helpers');

describe('Production Consumption', () => {
  let admin, token, warehouse, item;

  beforeEach(async () => {
    await resetDb();
    admin = await createUser({ role: 'ADMIN', email: 'admin@test.local' });
    token = await loginAs('admin@test.local');

    const category = await createCategory();
    warehouse = await createWarehouse();
    item = await createItem({ categoryId: category.id });
    await seedStock(item.id, warehouse.id, 100, admin.id);
  });

  afterAll(() => prisma.$disconnect());

  async function currentStock() {
    const res = await request(app).get(`/api/inventory/${item.id}`).set('Authorization', `Bearer ${token}`);
    return res.body.data.totalStock;
  }

  test('recording consumption decreases stock immediately — no approval step', async () => {
    const batchRes = await request(app).post('/api/production/batches').set('Authorization', `Bearer ${token}`).send({ product: 'Refined Sugar' });
    const batch = batchRes.body.data.batch;
    expect(batch.status).toBe('PLANNED');

    const consumeRes = await request(app)
      .post('/api/production/consumption')
      .set('Authorization', `Bearer ${token}`)
      .send({ productionBatchId: batch.id, items: [{ itemId: item.id, warehouseId: warehouse.id, quantityConsumed: 30 }] });
    expect(consumeRes.status).toBe(201);

    expect(await currentStock()).toBe(70);
  });

  test('the first consumption against a PLANNED batch auto-advances it to IN_PROGRESS', async () => {
    const batchRes = await request(app).post('/api/production/batches').set('Authorization', `Bearer ${token}`).send({ product: 'Refined Sugar' });
    const batch = batchRes.body.data.batch;

    await request(app)
      .post('/api/production/consumption')
      .set('Authorization', `Bearer ${token}`)
      .send({ productionBatchId: batch.id, items: [{ itemId: item.id, warehouseId: warehouse.id, quantityConsumed: 10 }] });

    const batchDetail = await request(app).get(`/api/production/batches/${batch.id}`).set('Authorization', `Bearer ${token}`);
    expect(batchDetail.body.data.batch.status).toBe('IN_PROGRESS');
  });

  test('consumption is blocked once a batch is marked COMPLETED', async () => {
    const batchRes = await request(app).post('/api/production/batches').set('Authorization', `Bearer ${token}`).send({ product: 'Refined Sugar' });
    const batch = batchRes.body.data.batch;
    await request(app).put(`/api/production/batches/${batch.id}`).set('Authorization', `Bearer ${token}`).send({ status: 'COMPLETED' });

    const res = await request(app)
      .post('/api/production/consumption')
      .set('Authorization', `Bearer ${token}`)
      .send({ productionBatchId: batch.id, items: [{ itemId: item.id, warehouseId: warehouse.id, quantityConsumed: 10 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('BATCH_COMPLETED');
    expect(await currentStock()).toBe(100); // untouched
  });

  test('cannot consume more than the available stock', async () => {
    const batchRes = await request(app).post('/api/production/batches').set('Authorization', `Bearer ${token}`).send({ product: 'Refined Sugar' });
    const batch = batchRes.body.data.batch;

    const res = await request(app)
      .post('/api/production/consumption')
      .set('Authorization', `Bearer ${token}`)
      .send({ productionBatchId: batch.id, items: [{ itemId: item.id, warehouseId: warehouse.id, quantityConsumed: 9999 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('INSUFFICIENT_STOCK');
    expect(await currentStock()).toBe(100);
  });

  test('a PRODUCTION_MANAGER can record consumption; an INVENTORY_MANAGER cannot (recordConsumption excludes them)', async () => {
    await createUser({ role: 'PRODUCTION_MANAGER', email: 'pm@test.local' });
    const pmToken = await loginAs('pm@test.local');
    await createUser({ role: 'INVENTORY_MANAGER', email: 'im@test.local' });
    const imToken = await loginAs('im@test.local');

    const batchRes = await request(app).post('/api/production/batches').set('Authorization', `Bearer ${pmToken}`).send({ product: 'Raw Sugar' });
    expect(batchRes.status).toBe(201);

    const deniedRes = await request(app).post('/api/production/batches').set('Authorization', `Bearer ${imToken}`).send({ product: 'Raw Sugar' });
    expect(deniedRes.status).toBe(403);
  });
});
