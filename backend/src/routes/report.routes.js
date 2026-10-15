const router = require('express').Router();
const controller = require('../controllers/report.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const {
  inventoryReportQuerySchema,
  purchaseReportQuerySchema,
  consumptionReportQuerySchema,
  stockMovementReportQuerySchema,
} = require('../validators/report.validator');

router.use(authenticate, authorize(ACCESS.viewReports));

router.get('/inventory', validate(inventoryReportQuerySchema, 'query'), controller.inventory);
router.get('/purchases', validate(purchaseReportQuerySchema, 'query'), controller.purchases);
router.get('/consumption', validate(consumptionReportQuerySchema, 'query'), controller.consumption);
router.get('/stock-movement', validate(stockMovementReportQuerySchema, 'query'), controller.stockMovement);

module.exports = router;
