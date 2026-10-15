const router = require('express').Router();
const controller = require('../controllers/supplier.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const {
  createSupplierSchema,
  updateSupplierSchema,
  listSupplierQuerySchema,
} = require('../validators/supplier.validator');

router.use(authenticate, authorize(ACCESS.manageSuppliers));

router.get('/', validate(listSupplierQuerySchema, 'query'), controller.list);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', validate(createSupplierSchema), controller.create);
router.put('/:id', validate(idParamSchema, 'params'), validate(updateSupplierSchema), controller.update);
router.delete('/:id', validate(idParamSchema, 'params'), controller.deactivate);

module.exports = router;
