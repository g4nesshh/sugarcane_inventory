const request = require('supertest');
const { app, prisma, resetDb, createUser, loginAs, createCategory, createWarehouse, createItem, seedStock } = require('./helpers');

describe('Stock Transfers', () => {
  let admin, token, source, destination, item;

  beforeEach(async () => {
    await resetDb();
    admin = await createUser({ role: 'ADMIN', email: 'admin@test.local' });
    token = await loginAs('admin@test.local');

    const category = await createCategory();
    source = await createWarehouse();
    destination = await createWarehouse();
    item = await createItem({ categoryId: category.id });
    await seedStock(item.id, source.id, 50, admin.id); // stock only exists at the source
  });

  afterAll(() => prisma.$disconnect());

  async function warehouseQty(itemId, warehouseId) {
    const res = await request(app).get(`/api/inventory/${itemId}`).set('Authorization', `Bearer ${token}`);
    const row = res.body.data.byWarehouse.find((w) => w.warehouse.id === warehouseId);
    return row ? row.quantity : 0;
  }

  test('approving a transfer moves stock from source to destination', async () => {
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceWarehouseId: source.id, destinationWarehouseId: destination.id, items: [{ itemId: item.id, quantity: 20 }] });
    const transfer = createRes.body.data.transfer;

    const approveRes = await request(app).put(`/api/transfers/${transfer.id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.transfer.status).toBe('COMPLETED');

    expect(await warehouseQty(item.id, source.id)).toBe(30);
    expect(await warehouseQty(item.id, destination.id)).toBe(20);
  });

  test('a transfer request does not move stock until approved', async () => {
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceWarehouseId: source.id, destinationWarehouseId: destination.id, items: [{ itemId: item.id, quantity: 20 }] });
    expect(createRes.body.data.transfer.status).toBe('PENDING');

    expect(await warehouseQty(item.id, source.id)).toBe(50);
    expect(await warehouseQty(item.id, destination.id)).toBe(0);
  });

  test('insufficient source stock blocks the ENTIRE transfer atomically — source stays untouched, destination gets nothing', async () => {
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({ sourceWarehouseId: source.id, destinationWarehouseId: destination.id, items: [{ itemId: item.id, quantity: 9999 }] });
    const transfer = createRes.body.data.transfer;

    const approveRes = await request(app).put(`/api/transfers/${transfer.id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(approveRes.status).toBe(409);
    expect(approveRes.body.error).toBe('INSUFFICIENT_STOCK');

    // The critical atomicity assertion: source must be EXACTLY what it was before
    // the failed attempt — not partially decremented — and destination must have
    // received nothing at all.
    expect(await warehouseQty(item.id, source.id)).toBe(50);
    expect(await warehouseQty(item.id, destination.id)).toBe(0);

    const transferRes = await request(app).get(`/api/transfers/${transfer.id}`).set('Authorization', `Bearer ${token}`);
    expect(transferRes.body.data.transfer.status).toBe('PENDING'); // not silently marked completed
  });

  test('a multi-line transfer where only the SECOND line has insufficient stock still rolls back the first line too', async () => {
    const category = await createCategory();
    const item2 = await createItem({ categoryId: category.id });
    await seedStock(item2.id, source.id, 5, admin.id); // only 5 available, but we'll request 20

    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceWarehouseId: source.id,
        destinationWarehouseId: destination.id,
        items: [
          { itemId: item.id, quantity: 20 }, // this line alone would succeed
          { itemId: item2.id, quantity: 20 }, // this line fails — only 5 available
        ],
      });
    const transfer = createRes.body.data.transfer;

    const approveRes = await request(app).put(`/api/transfers/${transfer.id}/approve`).set('Authorization', `Bearer ${token}`);
    expect(approveRes.status).toBe(409);

    // Line 1 (item) must NOT have moved even though it was processed before the
    // failing line — the whole transaction rolled back together.
    expect(await warehouseQty(item.id, source.id)).toBe(50);
    expect(await warehouseQty(item.id, destination.id)).toBe(0);
  });

  test('a non-manager cannot create a transfer (transferStock excludes Storekeeper)', async () => {
    await createUser({ role: 'STOREKEEPER', email: 'sk@test.local' });
    const skToken = await loginAs('sk@test.local');
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${skToken}`)
      .send({ sourceWarehouseId: source.id, destinationWarehouseId: destination.id, items: [{ itemId: item.id, quantity: 5 }] });
    expect(res.status).toBe(403);
  });
});
