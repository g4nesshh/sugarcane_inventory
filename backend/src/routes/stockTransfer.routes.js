const router = require('express').Router();
const controller = require('../controllers/stockTransfer.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const { createStockTransferSchema, listStockTransferQuerySchema } = require('../validators/stockTransfer.validator');

router.use(authenticate, authorize(ACCESS.transferStock));

router.get('/', validate(listStockTransferQuerySchema, 'query'), controller.list);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', validate(createStockTransferSchema), controller.create);
router.put('/:id/approve', authorize(ACCESS.approveIssueOrTransfer), validate(idParamSchema, 'params'), controller.approve);
router.put('/:id/reject', authorize(ACCESS.approveIssueOrTransfer), validate(idParamSchema, 'params'), controller.reject);

module.exports = router;
