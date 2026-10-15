const service = require('../services/warehouse.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { warehouses, meta } = await service.list(req.query);
  ok(res, { warehouses, meta });
});

exports.getById = asyncHandler(async (req, res) => {
  ok(res, { warehouse: await service.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { warehouse: await service.create(req.body) }, 'Warehouse created');
});

exports.update = asyncHandler(async (req, res) => {
  ok(res, { warehouse: await service.update(req.params.id, req.body) }, 'Warehouse updated');
});

exports.deactivate = asyncHandler(async (req, res) => {
  ok(res, { warehouse: await service.deactivate(req.params.id) }, 'Warehouse deactivated');
});
