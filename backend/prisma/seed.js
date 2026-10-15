require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/utils/prisma');
const { applyMovement } = require('../src/utils/stockService');

const DEV_PASSWORD = process.env.SEED_PASSWORD || 'Password@123';

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const users = [
    ['Admin User', 'admin@sugarfactory.local', 'ADMIN'],
    ['Inventory Manager', 'inventory@sugarfactory.local', 'INVENTORY_MANAGER'],
    ['Production Manager', 'production@sugarfactory.local', 'PRODUCTION_MANAGER'],
    ['Storekeeper', 'store@sugarfactory.local', 'STOREKEEPER'],
  ];
  for (const [name, email, role] of users) {
    await prisma.user.upsert({ where: { email }, update: {}, create: { name, email, role, passwordHash } });
  }
  const admin = await prisma.user.findUnique({ where: { email: 'admin@sugarfactory.local' } });

  const categories = ['Sugarcane', 'Chemicals', 'Packaging', 'Spare Parts', 'Fuel', 'Lubricants', 'Finished Products'];
  for (const name of categories) await prisma.category.upsert({ where: { name }, update: {}, create: { name } });

  const warehouses = [
    ['Main Store', 'Factory Gate Block A', 'R. Patil', 5000],
    ['Chemical Store', 'Process Block', 'S. Jadhav', 800],
    ['Spare Parts Store', 'Workshop Block', 'M. Kale', 1200],
    ['Packaging Store', 'Packing Hall', 'A. More', 3000],
    ['Finished Goods Store', 'Godown Complex', 'V. Shinde', 20000],
  ];
  for (const [name, location, manager, capacity] of warehouses) {
    await prisma.warehouse.upsert({ where: { name }, update: {}, create: { name, location, manager, capacity } });
  }

  const suppliers = [
    ['Shree Chemicals Pvt Ltd', 'Chemicals', '27AAAPL1234C1Z5'],
    ['Maharashtra Packaging Co', 'Packaging', '27AABCM5678D1Z2'],
    ['Bharat Petroleum Dealer', 'Fuel & Lubricants', '27AACBP9012E1Z8'],
    ['Precision Engg Spares', 'Spare Parts', '27AAECP3456F1Z1'],
  ];
  for (const [name, supplierType, gstNumber] of suppliers) {
    const exists = await prisma.supplier.findFirst({ where: { name } });
    if (!exists) await prisma.supplier.create({ data: { name, supplierType, gstNumber, paymentTerms: 'Net 30' } });
  }

  const cat = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.name, c.id]));
  const wh = Object.fromEntries((await prisma.warehouse.findMany()).map((w) => [w.name, w.id]));

  // [code, name, category, unit, min, reorder, max, unitCost, warehouse, opening qty]
  const items = [
    ['CANE-001', 'Sugarcane', 'Sugarcane', 'MT', 500, 800, 10000, 3150, 'Main Store', 2500],
    ['CHM-001', 'Lime (CaO)', 'Chemicals', 'KG', 2000, 3000, 20000, 12, 'Chemical Store', 8000],
    ['CHM-002', 'Sulfur', 'Chemicals', 'KG', 1000, 1500, 10000, 45, 'Chemical Store', 1200],
    ['LUB-001', 'Lubricant Oil', 'Lubricants', 'L', 100, 200, 2000, 210, 'Spare Parts Store', 450],
    ['LUB-002', 'Gear Oil', 'Lubricants', 'L', 100, 150, 1500, 260, 'Spare Parts Store', 90],
    ['FUEL-001', 'Diesel', 'Fuel', 'L', 1000, 2000, 15000, 92, 'Main Store', 6000],
    ['PKG-001', 'Jute Bags', 'Packaging', 'PCS', 5000, 8000, 80000, 42, 'Packaging Store', 30000],
    ['PKG-002', 'PP Bags', 'Packaging', 'PCS', 5000, 8000, 80000, 18, 'Packaging Store', 4000],
    ['SPR-001', 'Machine Bearing 6312', 'Spare Parts', 'PCS', 10, 20, 200, 1850, 'Spare Parts Store', 55],
    ['SPR-002', 'Conveyor Belt (20m)', 'Spare Parts', 'PCS', 2, 4, 30, 48500, 'Spare Parts Store', 0],
    ['FIN-001', 'Refined Sugar (50kg bag)', 'Finished Products', 'BAG', 500, 1000, 30000, 2100, 'Finished Goods Store', 6000],
    ['FIN-002', 'Raw Sugar (50kg bag)', 'Finished Products', 'BAG', 500, 1000, 30000, 1900, 'Finished Goods Store', 3500],
  ];

  for (const [itemCode, name, category, unit, min, reorder, max, unitCost, store, qty] of items) {
    const item = await prisma.item.upsert({
      where: { itemCode },
      update: {},
      create: {
        itemCode, name, unit, categoryId: cat[category],
        minimumStock: min, reorderLevel: reorder, maximumStock: max, unitCost,
      },
    });
    const existing = await prisma.stockMovement.findFirst({
      where: { itemId: item.id, referenceType: 'OPENING_BALANCE' },
    });
    if (qty > 0 && !existing) {
      // Opening balances use the same service, so the ledger stays consistent from day one.
      await prisma.$transaction((tx) =>
        applyMovement(tx, {
          itemId: item.id, warehouseId: wh[store], type: 'ADJUSTMENT_IN', quantity: qty,
          referenceType: 'OPENING_BALANCE', referenceNumber: 'OPEN-001', userId: admin.id,
          remarks: 'Seed opening balance',
        })
      );
    }
  }

  console.log('Seed complete. Dev password for all users:', DEV_PASSWORD);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
