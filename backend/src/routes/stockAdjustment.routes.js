const router = require('express').Router();
const controller = require('../controllers/stockAdjustment.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const { createStockAdjustmentSchema, listStockAdjustmentQuerySchema } = require('../validators/stockAdjustment.validator');

router.use(authenticate);

router.get('/', authorize(ACCESS.requestAdjustment), validate(listStockAdjustmentQuerySchema, 'query'), controller.list);
router.get('/:id', authorize(ACCESS.requestAdjustment), validate(idParamSchema, 'params'), controller.getById);
router.post('/', authorize(ACCESS.requestAdjustment), validate(createStockAdjustmentSchema), controller.create);
router.put('/:id/approve', authorize(ACCESS.approveAdjustment), validate(idParamSchema, 'params'), controller.approve);
router.put('/:id/reject', authorize(ACCESS.approveAdjustment), validate(idParamSchema, 'params'), controller.reject);

module.exports = router;
