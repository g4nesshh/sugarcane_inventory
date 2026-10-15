const router = require('express').Router();
const controller = require('../controllers/stockMovement.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { listMovementQuerySchema } = require('../validators/stockMovement.validator');

router.use(authenticate, authorize(ACCESS.viewLedger));

router.get('/', validate(listMovementQuerySchema, 'query'), controller.list);

module.exports = router;
