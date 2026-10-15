const router = require('express').Router();
const controller = require('../controllers/category.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const {
  createCategorySchema,
  updateCategorySchema,
  listCategoryQuerySchema,
} = require('../validators/category.validator');

router.use(authenticate);

router.get('/', validate(listCategoryQuerySchema, 'query'), controller.list);
router.get('/:id', validate(idParamSchema, 'params'), controller.getById);
router.post('/', authorize(ACCESS.manageCategories), validate(createCategorySchema), controller.create);
router.put(
  '/:id',
  authorize(ACCESS.manageCategories),
  validate(idParamSchema, 'params'),
  validate(updateCategorySchema),
  controller.update
);
router.delete(
  '/:id',
  authorize(ACCESS.manageCategories),
  validate(idParamSchema, 'params'),
  controller.deactivate
);

module.exports = router;
