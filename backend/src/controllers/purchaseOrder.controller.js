const service = require('../services/purchaseOrder.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { purchaseOrders, meta } = await service.list(req.query);
  ok(res, { purchaseOrders, meta });
});

exports.getById = asyncHandler(async (req, res) => {
  ok(res, { purchaseOrder: await service.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { purchaseOrder: await service.create(req.body, req.user.id) }, 'Purchase order created');
});

exports.update = asyncHandler(async (req, res) => {
  ok(res, { purchaseOrder: await service.update(req.params.id, req.body) }, 'Purchase order updated');
});
