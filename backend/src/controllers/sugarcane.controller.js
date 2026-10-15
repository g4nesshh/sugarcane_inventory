const service = require('../services/sugarcane.service');
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
  created(res, { receipt: await service.create(req.body, req.user.id) }, 'Sugarcane receipt recorded');
});

exports.crush = asyncHandler(async (req, res) => {
  ok(res, { receipt: await service.crush(req.params.id, req.body, req.user.id) }, 'Crushing recorded');
});
