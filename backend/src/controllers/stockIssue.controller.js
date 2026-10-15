const service = require('../services/stockIssue.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { issues, meta } = await service.list(req.query);
  ok(res, { issues, meta });
});

exports.getById = asyncHandler(async (req, res) => {
  ok(res, { issue: await service.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { issue: await service.create(req.body, req.user.id) }, 'Stock issue request created');
});

exports.approve = asyncHandler(async (req, res) => {
  ok(res, { issue: await service.approve(req.params.id, req.user.id) }, 'Stock issue approved');
});

exports.reject = asyncHandler(async (req, res) => {
  ok(res, { issue: await service.reject(req.params.id, req.user.id, req.body.remarks) }, 'Stock issue rejected');
});
