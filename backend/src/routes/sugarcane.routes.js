const router = require('express').Router();
const controller = require('../controllers/sugarcane.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const {
  createSugarcaneReceiptSchema,
  crushSugarcaneSchema,
  listSugarcaneQuerySchema,
} = require('../validators/sugarcane.validator');

router.use(authenticate, authorize(ACCESS.manageSugarcane));

router.get('/', validate(listSugarcaneQuerySchema, 'query'), controller.list);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', validate(createSugarcaneReceiptSchema), controller.create);
router.put('/:id/crush', validate(idParamSchema, 'params'), validate(crushSugarcaneSchema), controller.crush);

module.exports = router;
