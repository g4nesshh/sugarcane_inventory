const router = require('express').Router();
const controller = require('../controllers/productionBatch.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const {
  createProductionBatchSchema,
  updateProductionBatchSchema,
  listProductionBatchQuerySchema,
} = require('../validators/productionBatch.validator');

router.use(authenticate, authorize(ACCESS.recordConsumption));

router.get('/', validate(listProductionBatchQuerySchema, 'query'), controller.list);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', validate(createProductionBatchSchema), controller.create);
router.put('/:id', validate(idParamSchema, 'params'), validate(updateProductionBatchSchema), controller.update);

module.exports = router;
