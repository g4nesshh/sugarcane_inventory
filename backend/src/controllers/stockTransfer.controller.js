const service = require('../services/stockTransfer.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { transfers, meta } = await service.list(req.query);
  ok(res, { transfers, meta });
});

exports.getById = asyncHandler(async (req, res) => {
  ok(res, { transfer: await service.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { transfer: await service.create(req.body, req.user.id) }, 'Stock transfer request created');
});

exports.approve = asyncHandler(async (req, res) => {
  ok(res, { transfer: await service.approve(req.params.id, req.user.id) }, 'Stock transfer completed');
});

exports.reject = asyncHandler(async (req, res) => {
  ok(res, { transfer: await service.reject(req.params.id, req.user.id) }, 'Stock transfer rejected');
});
