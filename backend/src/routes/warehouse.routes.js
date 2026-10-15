const router = require('express').Router();
const controller = require('../controllers/warehouse.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const {
  createWarehouseSchema,
  updateWarehouseSchema,
  listWarehouseQuerySchema,
} = require('../validators/warehouse.validator');

router.use(authenticate);

router.get('/', validate(listWarehouseQuerySchema, 'query'), controller.list);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', authorize(ACCESS.manageWarehouses), validate(createWarehouseSchema), controller.create);
router.put(
  '/:id',
  authorize(ACCESS.manageWarehouses),
  validate(idParamSchema, 'params'),
  validate(updateWarehouseSchema),
  controller.update
);
router.delete(
  '/:id',
  authorize(ACCESS.manageWarehouses),
  validate(idParamSchema, 'params'),
  controller.deactivate
);

module.exports = router;
