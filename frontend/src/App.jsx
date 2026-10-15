import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Categories from './pages/Categories';
import Warehouses from './pages/Warehouses';
import Items from './pages/Items';
import Inventory from './pages/Inventory';
import StockMovements from './pages/StockMovements';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import PurchaseOrderForm from './pages/PurchaseOrderForm';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail';
import GoodsReceipts from './pages/GoodsReceipts';
import GoodsReceiptForm from './pages/GoodsReceiptForm';
import StockIssues from './pages/StockIssues';
import StockIssueForm from './pages/StockIssueForm';
import StockIssueDetail from './pages/StockIssueDetail';
import StockTransfers from './pages/StockTransfers';
import StockTransferForm from './pages/StockTransferForm';
import StockTransferDetail from './pages/StockTransferDetail';
import ProductionBatches from './pages/ProductionBatches';
import ProductionBatchDetail from './pages/ProductionBatchDetail';
import Sugarcane from './pages/Sugarcane';
import SugarcaneReceiptDetail from './pages/SugarcaneReceiptDetail';
import Adjustments from './pages/Adjustments';
import AdjustmentDetail from './pages/AdjustmentDetail';
import Reports from './pages/Reports';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

const MANAGERS = ['ADMIN', 'INVENTORY_MANAGER'];
const RECEIVERS = ['ADMIN', 'INVENTORY_MANAGER', 'STOREKEEPER']; // matches receiveStock and issueStock permissions (same role set)
const PRODUCTION = ['ADMIN', 'PRODUCTION_MANAGER']; // matches recordConsumption
const CANE = ['ADMIN', 'INVENTORY_MANAGER', 'STOREKEEPER']; // matches manageSugarcane
const ADJUSTERS = ['ADMIN', 'INVENTORY_MANAGER', 'STOREKEEPER']; // matches requestAdjustment; approve is further gated in-page
const REPORT_VIEWERS = ['ADMIN', 'INVENTORY_MANAGER', 'PRODUCTION_MANAGER']; // matches viewReports

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/warehouses" element={<Warehouses />} />
        <Route path="/items" element={<Items />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route
          path="/stock-movements"
          element={
            <ProtectedRoute roles={MANAGERS}>
              <StockMovements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute roles={MANAGERS}>
              <Suppliers />
            </ProtectedRoute>
          }
        />
        <Route path="/purchases" element={<PurchaseOrders />} />
        <Route
          path="/purchases/new"
          element={
            <ProtectedRoute roles={MANAGERS}>
              <PurchaseOrderForm />
            </ProtectedRoute>
          }
        />
        <Route path="/purchases/:id" element={<PurchaseOrderDetail />} />
        <Route
          path="/receipts"
          element={
            <ProtectedRoute roles={RECEIVERS}>
              <GoodsReceipts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/receipts/new"
          element={
            <ProtectedRoute roles={RECEIVERS}>
              <GoodsReceiptForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/issues"
          element={
            <ProtectedRoute roles={RECEIVERS}>
              <StockIssues />
            </ProtectedRoute>
          }
        />
        <Route
          path="/issues/new"
          element={
            <ProtectedRoute roles={RECEIVERS}>
              <StockIssueForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/issues/:id"
          element={
            <ProtectedRoute roles={RECEIVERS}>
              <StockIssueDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfers"
          element={
            <ProtectedRoute roles={MANAGERS}>
              <StockTransfers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfers/new"
          element={
            <ProtectedRoute roles={MANAGERS}>
              <StockTransferForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfers/:id"
          element={
            <ProtectedRoute roles={MANAGERS}>
              <StockTransferDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/production/batches"
          element={
            <ProtectedRoute roles={PRODUCTION}>
              <ProductionBatches />
            </ProtectedRoute>
          }
        />
        <Route
          path="/production/batches/:id"
          element={
            <ProtectedRoute roles={PRODUCTION}>
              <ProductionBatchDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sugarcane"
          element={
            <ProtectedRoute roles={CANE}>
              <Sugarcane />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sugarcane/:id"
          element={
            <ProtectedRoute roles={CANE}>
              <SugarcaneReceiptDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adjustments"
          element={
            <ProtectedRoute roles={ADJUSTERS}>
              <Adjustments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adjustments/:id"
          element={
            <ProtectedRoute roles={ADJUSTERS}>
              <AdjustmentDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute roles={REPORT_VIEWERS}>
              <Reports />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
