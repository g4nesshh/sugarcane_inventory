const router = require('express').Router();
const controller = require('../controllers/stockIssue.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { idParamSchema } = require('../validators/common.validator');
const { createStockIssueSchema, decisionSchema, listStockIssueQuerySchema } = require('../validators/stockIssue.validator');

router.use(authenticate);

router.get('/', authorize(ACCESS.issueStock), validate(listStockIssueQuerySchema, 'query'), controller.list);
router.get('/:id', authorize(ACCESS.issueStock), validate(idParamSchema, 'params'), controller.getById);
router.post('/', authorize(ACCESS.issueStock), validate(createStockIssueSchema), controller.create);
router.put(
  '/:id/approve',
  authorize(ACCESS.approveIssueOrTransfer),
  validate(idParamSchema, 'params'),
  controller.approve
);
router.put(
  '/:id/reject',
  authorize(ACCESS.approveIssueOrTransfer),
  validate(idParamSchema, 'params'),
  validate(decisionSchema),
  controller.reject
);

module.exports = router;
