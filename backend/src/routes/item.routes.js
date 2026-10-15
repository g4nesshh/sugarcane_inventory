const router = require('express').Router();
const controller = require('../controllers/item.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const { createItemSchema, updateItemSchema, listItemQuerySchema } = require('../validators/item.validator');

router.use(authenticate);

router.get('/', validate(listItemQuerySchema, 'query'), controller.list);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', authorize(ACCESS.manageItems), validate(createItemSchema), controller.create);
router.put(
  '/:id',
  authorize(ACCESS.manageItems),
  validate(idParamSchema, 'params'),
  validate(updateItemSchema),
  controller.update
);
router.delete('/:id', authorize(ACCESS.manageItems), validate(idParamSchema, 'params'), controller.deactivate);

module.exports = router;
