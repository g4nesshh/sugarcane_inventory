const router = require('express').Router();
const controller = require('../controllers/productionConsumption.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { createConsumptionSchema, listConsumptionQuerySchema } = require('../validators/productionConsumption.validator');

router.use(authenticate, authorize(ACCESS.recordConsumption));

router.get('/', validate(listConsumptionQuerySchema, 'query'), controller.list);
router.post('/', validate(createConsumptionSchema), controller.create);

module.exports = router;
