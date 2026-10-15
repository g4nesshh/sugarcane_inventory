const request = require('supertest');
const { app, prisma, resetDb, createUser, loginAs, createCategory, createWarehouse, createItem, seedStock } = require('./helpers');

describe('Stock Issues', () => {
  let admin, adminToken, skToken, warehouse, item;

  beforeEach(async () => {
    await resetDb();
    admin = await createUser({ role: 'ADMIN', email: 'admin@test.local' });
    adminToken = await loginAs('admin@test.local');
    await createUser({ role: 'STOREKEEPER', email: 'sk@test.local' });
    skToken = await loginAs('sk@test.local');

    const category = await createCategory();
    warehouse = await createWarehouse();
    item = await createItem({ categoryId: category.id });
    await seedStock(item.id, warehouse.id, 100, admin.id);
  });

  afterAll(() => prisma.$disconnect());

  test('requesting an issue creates a PENDING record and does not touch stock yet', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${skToken}`)
      .send({ department: 'PRODUCTION', items: [{ itemId: item.id, warehouseId: warehouse.id, quantity: 30 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.issue.status).toBe('PENDING');

    const inv = await request(app).get(`/api/inventory/${item.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(inv.body.data.totalStock).toBe(100); // unchanged
  });

  test('approving an issue decreases stock by the requested quantity', async () => {
    const createRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${skToken}`)
      .send({ department: 'PRODUCTION', items: [{ itemId: item.id, warehouseId: warehouse.id, quantity: 30 }] });
    const issue = createRes.body.data.issue;

    const approveRes = await request(app).put(`/api/issues/${issue.id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.issue.status).toBe('APPROVED');

    const inv = await request(app).get(`/api/inventory/${item.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(inv.body.data.totalStock).toBe(70);
  });

  test('cannot approve an issue for more than is currently available (negative stock prevention)', async () => {
    const createRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${skToken}`)
      .send({ department: 'PRODUCTION', items: [{ itemId: item.id, warehouseId: warehouse.id, quantity: 9999 }] });
    const issue = createRes.body.data.issue;

    const approveRes = await request(app).put(`/api/issues/${issue.id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(409);
    expect(approveRes.body.error).toBe('INSUFFICIENT_STOCK');

    // A failed approval must not partially apply — stock stays exactly where it was.
    const inv = await request(app).get(`/api/inventory/${item.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(inv.body.data.totalStock).toBe(100);

    const issueRes = await request(app).get(`/api/issues/${issue.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(issueRes.body.data.issue.status).toBe('PENDING'); // still pending, not silently marked approved
  });

  test('insufficient-stock is checked against LIVE quantity at approval time, not request time', async () => {
    // Request an issue for 80 while 100 is available — valid when requested.
    const createRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${skToken}`)
      .send({ department: 'PRODUCTION', items: [{ itemId: item.id, warehouseId: warehouse.id, quantity: 80 }] });
    const issue = createRes.body.data.issue;

    // Stock drops to 50 via a second, unrelated issue approved in between.
    const otherIssue = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${skToken}`)
      .send({ department: 'MAINTENANCE', items: [{ itemId: item.id, warehouseId: warehouse.id, quantity: 50 }] });
    await request(app).put(`/api/issues/${otherIssue.body.data.issue.id}/approve`).set('Authorization', `Bearer ${adminToken}`);

    // Now only 50 remains — approving the original 80-unit request must fail.
    const approveRes = await request(app).put(`/api/issues/${issue.id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(409);
    expect(approveRes.body.error).toBe('INSUFFICIENT_STOCK');
  });

  test('a STOREKEEPER cannot approve their own issue request (approval is ADMIN/INVENTORY_MANAGER only)', async () => {
    const createRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${skToken}`)
      .send({ department: 'PRODUCTION', items: [{ itemId: item.id, warehouseId: warehouse.id, quantity: 10 }] });
    const issue = createRes.body.data.issue;

    const res = await request(app).put(`/api/issues/${issue.id}/approve`).set('Authorization', `Bearer ${skToken}`);
    expect(res.status).toBe(403);
  });

  test('rejecting an issue closes it with no stock effect', async () => {
    const createRes = await request(app)
      .post('/api/issues')
      .set('Authorization', `Bearer ${skToken}`)
      .send({ department: 'PRODUCTION', items: [{ itemId: item.id, warehouseId: warehouse.id, quantity: 30 }] });
    const issue = createRes.body.data.issue;

    const rejectRes = await request(app).put(`/api/issues/${issue.id}/reject`).set('Authorization', `Bearer ${adminToken}`).send({});
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.issue.status).toBe('REJECTED');

    const inv = await request(app).get(`/api/inventory/${item.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(inv.body.data.totalStock).toBe(100);
  });
});
