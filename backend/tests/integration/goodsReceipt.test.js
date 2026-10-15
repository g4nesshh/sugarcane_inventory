const request = require('supertest');
const {
  app, prisma, resetDb, createUser, loginAs, createCategory, createWarehouse, createSupplier, createItem, createApprovedPO,
} = require('./helpers');

describe('Creating inventory + Goods Receipts', () => {
  let token, category, warehouse, supplier, item;

  beforeEach(async () => {
    await resetDb();
    await createUser({ role: 'ADMIN', email: 'admin@test.local' });
    token = await loginAs('admin@test.local');
    category = await createCategory();
    warehouse = await createWarehouse();
    supplier = await createSupplier();
    item = await createItem({ categoryId: category.id });
  });

  afterAll(() => prisma.$disconnect());

  test('a newly created item starts with zero stock', async () => {
    const res = await request(app).get(`/api/inventory/${item.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalStock).toBe(0);
    expect(res.body.data.stockStatus).toBe('OUT_OF_STOCK');
  });

  test('receiving against an approved PO increases stock and writes exactly one ledger entry', async () => {
    const po = await createApprovedPO(token, { supplierId: supplier.id, items: [{ itemId: item.id, orderedQuantity: 100, unitPrice: 10 }] });

    const receiptRes = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseOrderId: po.id, warehouseId: warehouse.id, items: [{ itemId: item.id, quantity: 100 }] });
    expect(receiptRes.status).toBe(201);

    const invRes = await request(app).get(`/api/inventory/${item.id}`).set('Authorization', `Bearer ${token}`);
    expect(invRes.body.data.totalStock).toBe(100);

    const ledgerRes = await request(app).get('/api/stock-movements').set('Authorization', `Bearer ${token}`).query({ itemId: item.id });
    expect(ledgerRes.body.data.movements).toHaveLength(1);
    expect(ledgerRes.body.data.movements[0].type).toBe('PURCHASE_RECEIPT');
  });

  test('the PO status advances to RECEIVED once fully received', async () => {
    const po = await createApprovedPO(token, { supplierId: supplier.id, items: [{ itemId: item.id, orderedQuantity: 100, unitPrice: 10 }] });
    await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseOrderId: po.id, warehouseId: warehouse.id, items: [{ itemId: item.id, quantity: 100 }] });

    const poRes = await request(app).get(`/api/purchases/${po.id}`).set('Authorization', `Bearer ${token}`);
    expect(poRes.body.data.purchaseOrder.status).toBe('RECEIVED');
  });

  test('receiving less than ordered leaves the PO PARTIALLY_RECEIVED', async () => {
    const po = await createApprovedPO(token, { supplierId: supplier.id, items: [{ itemId: item.id, orderedQuantity: 100, unitPrice: 10 }] });
    await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseOrderId: po.id, warehouseId: warehouse.id, items: [{ itemId: item.id, quantity: 40 }] });

    const poRes = await request(app).get(`/api/purchases/${po.id}`).set('Authorization', `Bearer ${token}`);
    expect(poRes.body.data.purchaseOrder.status).toBe('PARTIALLY_RECEIVED');
  });

  test('cannot receive more than the ordered quantity on a line (over-receipt guard)', async () => {
    const po = await createApprovedPO(token, { supplierId: supplier.id, items: [{ itemId: item.id, orderedQuantity: 50, unitPrice: 10 }] });
    const res = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseOrderId: po.id, warehouseId: warehouse.id, items: [{ itemId: item.id, quantity: 51 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('OVER_RECEIPT');

    // Confirm the rejected attempt left no trace on stock.
    const invRes = await request(app).get(`/api/inventory/${item.id}`).set('Authorization', `Bearer ${token}`);
    expect(invRes.body.data.totalStock).toBe(0);
  });

  test('cannot receive against a PO that is still DRAFT', async () => {
    const createRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ supplierId: supplier.id, items: [{ itemId: item.id, orderedQuantity: 50, unitPrice: 10 }] });
    const po = createRes.body.data.purchaseOrder;

    const res = await request(app)
      .post('/api/receipts')
      .set('Authorization', `Bearer ${token}`)
      .send({ purchaseOrderId: po.id, warehouseId: warehouse.id, items: [{ itemId: item.id, quantity: 10 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('PO_NOT_RECEIVABLE');
  });

  test('retrying the same submission with an idempotencyKey does not double-credit stock', async () => {
    const po = await createApprovedPO(token, { supplierId: supplier.id, items: [{ itemId: item.id, orderedQuantity: 100, unitPrice: 10 }] });
    const payload = {
      purchaseOrderId: po.id, warehouseId: warehouse.id, idempotencyKey: 'retry-key-1', items: [{ itemId: item.id, quantity: 40 }],
    };

    const first = await request(app).post('/api/receipts').set('Authorization', `Bearer ${token}`).send(payload);
    const second = await request(app).post('/api/receipts').set('Authorization', `Bearer ${token}`).send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.receipt.id).toBe(first.body.data.receipt.id); // same receipt handed back, not a new one

    const invRes = await request(app).get(`/api/inventory/${item.id}`).set('Authorization', `Bearer ${token}`);
    expect(invRes.body.data.totalStock).toBe(40); // credited once, not twice
  });
});
