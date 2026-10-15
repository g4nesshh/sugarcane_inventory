const router = require('express').Router();
const controller = require('../controllers/inventory.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { listInventoryQuerySchema, itemIdParamSchema } = require('../validators/inventory.validator');

router.use(authenticate, authorize(ACCESS.viewInventory));

router.get('/', validate(listInventoryQuerySchema, 'query'), controller.list);
router.get('/:itemId', validate(itemIdParamSchema, 'params'), controller.getByItem);

module.exports = router;
