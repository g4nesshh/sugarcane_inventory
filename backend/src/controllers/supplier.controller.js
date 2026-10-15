const service = require('../services/supplier.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { suppliers, meta } = await service.list(req.query);
  ok(res, { suppliers, meta });
});

exports.getById = asyncHandler(async (req, res) => {
  ok(res, { supplier: await service.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { supplier: await service.create(req.body) }, 'Supplier created');
});

exports.update = asyncHandler(async (req, res) => {
  ok(res, { supplier: await service.update(req.params.id, req.body) }, 'Supplier updated');
});

exports.deactivate = asyncHandler(async (req, res) => {
  ok(res, { supplier: await service.deactivate(req.params.id) }, 'Supplier deactivated');
});
