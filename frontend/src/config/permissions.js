// Mirrors backend/src/config/permissions.js. Used only to show/hide actions the
// user can't perform anyway — the backend re-checks every request regardless.
const ADMIN = 'ADMIN';
const INVENTORY_MANAGER = 'INVENTORY_MANAGER';
const PRODUCTION_MANAGER = 'PRODUCTION_MANAGER';
const STOREKEEPER = 'STOREKEEPER';

export const ACCESS = {
  manageCategories: [ADMIN, INVENTORY_MANAGER],
  manageWarehouses: [ADMIN],
  manageItems: [ADMIN, INVENTORY_MANAGER],
  manageSuppliers: [ADMIN, INVENTORY_MANAGER],
  managePurchases: [ADMIN, INVENTORY_MANAGER],
  viewPurchases: [ADMIN, INVENTORY_MANAGER, STOREKEEPER],
  receiveStock: [ADMIN, INVENTORY_MANAGER, STOREKEEPER],
  issueStock: [ADMIN, INVENTORY_MANAGER, STOREKEEPER],
  approveIssueOrTransfer: [ADMIN, INVENTORY_MANAGER],
  transferStock: [ADMIN, INVENTORY_MANAGER],
  requestAdjustment: [ADMIN, INVENTORY_MANAGER, STOREKEEPER],
  approveAdjustment: [ADMIN],
  recordConsumption: [ADMIN, PRODUCTION_MANAGER],
  manageSugarcane: [ADMIN, INVENTORY_MANAGER, STOREKEEPER],
  viewReports: [ADMIN, INVENTORY_MANAGER, PRODUCTION_MANAGER],
};

export const can = (role, action) => (ACCESS[action] || []).includes(role);
