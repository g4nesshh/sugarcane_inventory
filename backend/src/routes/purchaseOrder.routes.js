const router = require('express').Router();
const controller = require('../controllers/purchaseOrder.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  listPurchaseOrderQuerySchema,
} = require('../validators/purchaseOrder.validator');

router.use(authenticate);

router.get('/', authorize(ACCESS.viewPurchases), validate(listPurchaseOrderQuerySchema, 'query'), controller.list);
router.get('/:id', authorize(ACCESS.viewPurchases), validate(idParamSchema, 'params'), controller.getById);
router.post('/', authorize(ACCESS.managePurchases), validate(createPurchaseOrderSchema), controller.create);
router.put(
  '/:id',
  authorize(ACCESS.managePurchases),
  validate(idParamSchema, 'params'),
  validate(updatePurchaseOrderSchema),
  controller.update
);

module.exports = router;
