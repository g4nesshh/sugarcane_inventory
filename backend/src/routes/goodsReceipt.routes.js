const router = require('express').Router();
const controller = require('../controllers/goodsReceipt.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const { createGoodsReceiptSchema, listGoodsReceiptQuerySchema } = require('../validators/goodsReceipt.validator');

router.use(authenticate, authorize(ACCESS.receiveStock));

router.get('/', validate(listGoodsReceiptQuerySchema, 'query'), controller.list);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', validate(createGoodsReceiptSchema), controller.create);

module.exports = router;
