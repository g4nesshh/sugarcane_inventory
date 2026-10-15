// Central role definitions; later phases import these instead of hard-coding role lists.
const ROLES = {
  ADMIN: 'ADMIN',
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',
  PRODUCTION_MANAGER: 'PRODUCTION_MANAGER',
  STOREKEEPER: 'STOREKEEPER',
};
const { ADMIN, INVENTORY_MANAGER, PRODUCTION_MANAGER, STOREKEEPER } = ROLES;

const ACCESS = {
  manageUsers: [ADMIN],
  manageCategories: [ADMIN, INVENTORY_MANAGER],
  manageWarehouses: [ADMIN],
  manageItems: [ADMIN, INVENTORY_MANAGER],
  manageSuppliers: [ADMIN, INVENTORY_MANAGER],
  managePurchases: [ADMIN, INVENTORY_MANAGER],
  viewPurchases: [ADMIN, INVENTORY_MANAGER, STOREKEEPER],
  viewInventory: [ADMIN, INVENTORY_MANAGER, PRODUCTION_MANAGER, STOREKEEPER],
  receiveStock: [ADMIN, INVENTORY_MANAGER, STOREKEEPER],
  issueStock: [ADMIN, INVENTORY_MANAGER, STOREKEEPER],
  approveIssueOrTransfer: [ADMIN, INVENTORY_MANAGER],
  transferStock: [ADMIN, INVENTORY_MANAGER],
  requestAdjustment: [ADMIN, INVENTORY_MANAGER, STOREKEEPER],
  approveAdjustment: [ADMIN],
  recordConsumption: [ADMIN, PRODUCTION_MANAGER],
  manageSugarcane: [ADMIN, INVENTORY_MANAGER, STOREKEEPER],
  viewReports: [ADMIN, INVENTORY_MANAGER, PRODUCTION_MANAGER],
  viewLedger: [ADMIN, INVENTORY_MANAGER],
};

module.exports = { ROLES, ACCESS };
