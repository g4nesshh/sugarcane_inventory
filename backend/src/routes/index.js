const router = require('express').Router();

router.get('/health', (req, res) => res.json({ success: true, message: 'OK', data: { uptime: process.uptime() } }));
router.use('/auth', require('./auth.routes'));
router.use('/categories', require('./category.routes'));
router.use('/warehouses', require('./warehouse.routes'));
router.use('/items', require('./item.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/stock-movements', require('./stockMovement.routes'));
router.use('/suppliers', require('./supplier.routes'));
router.use('/purchases', require('./purchaseOrder.routes'));
router.use('/receipts', require('./goodsReceipt.routes'));
router.use('/issues', require('./stockIssue.routes'));
router.use('/transfers', require('./stockTransfer.routes'));
router.use('/production/batches', require('./productionBatch.routes'));
router.use('/production/consumption', require('./productionConsumption.routes'));
router.use('/sugarcane', require('./sugarcane.routes'));
router.use('/adjustments', require('./stockAdjustment.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/reports', require('./report.routes'));

module.exports = router;
