import { LayoutDashboard, Tags, Warehouse, Package, Boxes, ScrollText, Truck, FileText, PackageCheck, PackageMinus, ArrowLeftRight, Factory, Sprout, Scale, FileBarChart } from 'lucide-react';

const ALL_ROLES = ['ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER', 'STOREKEEPER'];

// Grouped by domain to mirror how the backend itself is organized. Only routes
// that actually exist belong here — new groups/items are appended as each
// module's frontend is built, not stubbed in ahead of time.
export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ALL_ROLES }],
  },
  {
    label: 'Masters',
    items: [
      { label: 'Categories', path: '/categories', icon: Tags, roles: ALL_ROLES },
      { label: 'Warehouses', path: '/warehouses', icon: Warehouse, roles: ALL_ROLES },
      { label: 'Items', path: '/items', icon: Package, roles: ALL_ROLES },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Stock', path: '/inventory', icon: Boxes, roles: ALL_ROLES },
      // Ledger view mirrors the backend's viewLedger permission — Production
      // Manager and Storekeeper can see current stock but not the full ledger.
      { label: 'Movement ledger', path: '/stock-movements', icon: ScrollText, roles: ['ADMIN', 'INVENTORY_MANAGER'] },
    ],
  },
  {
    label: 'Procurement',
    items: [
      // Suppliers GET is manageSuppliers-gated on the backend (unlike most masters) — Storekeeper excluded.
      { label: 'Suppliers', path: '/suppliers', icon: Truck, roles: ['ADMIN', 'INVENTORY_MANAGER'] },
      { label: 'Purchase orders', path: '/purchases', icon: FileText, roles: ['ADMIN', 'INVENTORY_MANAGER', 'STOREKEEPER'] },
      // receiveStock permission — Production Manager excluded (unlike Purchase Orders' broader viewPurchases).
      { label: 'Goods receipts', path: '/receipts', icon: PackageCheck, roles: ['ADMIN', 'INVENTORY_MANAGER', 'STOREKEEPER'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      // issueStock permission — same role set as receiveStock; approve/reject is further
      // gated in-page (approveIssueOrTransfer, ADMIN+INVENTORY_MANAGER only).
      { label: 'Stock issues', path: '/issues', icon: PackageMinus, roles: ['ADMIN', 'INVENTORY_MANAGER', 'STOREKEEPER'] },
      // transferStock permission — narrower than issueStock/receiveStock, Storekeeper excluded.
      { label: 'Stock transfers', path: '/transfers', icon: ArrowLeftRight, roles: ['ADMIN', 'INVENTORY_MANAGER'] },
      // requestAdjustment permission — Storekeeper can request (they do the physical counts)
      // but approval is further gated in-page (approveAdjustment, ADMIN only).
      { label: 'Stock adjustments', path: '/adjustments', icon: Scale, roles: ['ADMIN', 'INVENTORY_MANAGER', 'STOREKEEPER'] },
    ],
  },
  {
    label: 'Production',
    items: [
      // recordConsumption permission — Production Manager's own domain; Inventory Manager/Storekeeper excluded.
      { label: 'Production batches', path: '/production/batches', icon: Factory, roles: ['ADMIN', 'PRODUCTION_MANAGER'] },
      // manageSugarcane permission — notably excludes Production Manager, unlike the rest of this group.
      { label: 'Sugarcane', path: '/sugarcane', icon: Sprout, roles: ['ADMIN', 'INVENTORY_MANAGER', 'STOREKEEPER'] },
    ],
  },
  {
    label: 'Reports',
    items: [
      // viewReports permission — Storekeeper excluded here, unlike most operational pages.
      { label: 'Reports', path: '/reports', icon: FileBarChart, roles: ['ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER'] },
    ],
  },
];

export function visibleNavGroups(role) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
