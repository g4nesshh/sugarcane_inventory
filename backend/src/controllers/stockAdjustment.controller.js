const service = require('../services/stockAdjustment.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { adjustments, meta } = await service.list(req.query);
  ok(res, { adjustments, meta });
});

exports.getById = asyncHandler(async (req, res) => {
  ok(res, { adjustment: await service.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { adjustment: await service.create(req.body, req.user.id) }, 'Stock adjustment request created');
});

exports.approve = asyncHandler(async (req, res) => {
  ok(res, { adjustment: await service.approve(req.params.id, req.user.id) }, 'Stock adjustment approved');
});

exports.reject = asyncHandler(async (req, res) => {
  ok(res, { adjustment: await service.reject(req.params.id, req.user.id) }, 'Stock adjustment rejected');
});
