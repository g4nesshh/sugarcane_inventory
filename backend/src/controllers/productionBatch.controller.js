const service = require('../services/productionBatch.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { batches, meta } = await service.list(req.query);
  ok(res, { batches, meta });
});

exports.getById = asyncHandler(async (req, res) => {
  ok(res, { batch: await service.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { batch: await service.create(req.body) }, 'Production batch created');
});

exports.update = asyncHandler(async (req, res) => {
  ok(res, { batch: await service.update(req.params.id, req.body) }, 'Production batch updated');
});
