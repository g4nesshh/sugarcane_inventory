const service = require('../services/goodsReceipt.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { receipts, meta } = await service.list(req.query);
  ok(res, { receipts, meta });
});

exports.getById = asyncHandler(async (req, res) => {
  ok(res, { receipt: await service.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { receipt: await service.create(req.body, req.user.id) }, 'Goods receipt recorded');
});
