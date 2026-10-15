const router = require('express').Router();
const controller = require('../controllers/dashboard.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');

router.use(authenticate, authorize(ACCESS.viewReports));

router.get('/summary', controller.summary);
router.get('/stock-movement', controller.stockMovement);
router.get('/low-stock', controller.lowStock);

module.exports = router;
