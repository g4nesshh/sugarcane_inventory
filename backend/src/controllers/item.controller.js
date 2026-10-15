const service = require('../services/item.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.list(req.query);
  ok(res, { items, meta });
});

exports.getById = asyncHandler(async (req, res) => {
  ok(res, { item: await service.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { item: await service.create(req.body) }, 'Item created');
});

exports.update = asyncHandler(async (req, res) => {
  ok(res, { item: await service.update(req.params.id, req.body) }, 'Item updated');
});

exports.deactivate = asyncHandler(async (req, res) => {
  ok(res, { item: await service.deactivate(req.params.id) }, 'Item deactivated');
});
