const request = require('supertest');
const { app, prisma, resetDb, createUser, loginAs, DEFAULT_PASSWORD } = require('./helpers');

describe('Auth: login', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  test('valid credentials return a token and never expose the password hash', async () => {
    await createUser({ role: 'ADMIN', email: 'admin@test.local' });
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user.email).toBe('admin@test.local');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  test('wrong password is rejected with 401', async () => {
    await createUser({ role: 'ADMIN', email: 'admin@test.local' });
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('a deactivated account cannot log in even with the correct password', async () => {
    await createUser({ role: 'ADMIN', email: 'inactive@test.local', status: 'INACTIVE' });
    const res = await request(app).post('/api/auth/login').send({ email: 'inactive@test.local', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(403);
  });

  test('GET /api/auth/me without a token is rejected with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me with a valid token returns the current user', async () => {
    await createUser({ role: 'STOREKEEPER', email: 'sk@test.local' });
    const token = await loginAs('sk@test.local');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('STOREKEEPER');
  });
});

describe('Auth: role-based authorization', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  test('a STOREKEEPER cannot create a warehouse (manageWarehouses is ADMIN-only)', async () => {
    await createUser({ role: 'STOREKEEPER', email: 'sk@test.local' });
    const token = await loginAs('sk@test.local');
    const res = await request(app).post('/api/warehouses').set('Authorization', `Bearer ${token}`).send({ name: 'Should Fail' });
    expect(res.status).toBe(403);
  });

  test('an INVENTORY_MANAGER cannot create a warehouse either (still ADMIN-only)', async () => {
    await createUser({ role: 'INVENTORY_MANAGER', email: 'im@test.local' });
    const token = await loginAs('im@test.local');
    const res = await request(app).post('/api/warehouses').set('Authorization', `Bearer ${token}`).send({ name: 'Should Fail' });
    expect(res.status).toBe(403);
  });

  test('an ADMIN can create a warehouse', async () => {
    await createUser({ role: 'ADMIN', email: 'admin@test.local' });
    const token = await loginAs('admin@test.local');
    const res = await request(app).post('/api/warehouses').set('Authorization', `Bearer ${token}`).send({ name: 'Main Store Test' });
    expect(res.status).toBe(201);
  });

  test('a PRODUCTION_MANAGER cannot view the stock movement ledger (viewLedger excludes them)', async () => {
    await createUser({ role: 'PRODUCTION_MANAGER', email: 'pm@test.local' });
    const token = await loginAs('pm@test.local');
    const res = await request(app).get('/api/stock-movements').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
