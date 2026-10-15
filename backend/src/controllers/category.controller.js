const service = require('../services/category.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { categories, meta } = await service.list(req.query);
  ok(res, { categories, meta });
});

exports.getById = asyncHandler(async (req, res) => {
  ok(res, { category: await service.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { category: await service.create(req.body) }, 'Category created');
});

exports.update = asyncHandler(async (req, res) => {
  ok(res, { category: await service.update(req.params.id, req.body) }, 'Category updated');
});

exports.deactivate = asyncHandler(async (req, res) => {
  ok(res, { category: await service.deactivate(req.params.id) }, 'Category deactivated');
});
