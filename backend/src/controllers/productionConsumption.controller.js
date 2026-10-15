const service = require('../services/productionConsumption.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { consumptions, meta } = await service.list(req.query);
  ok(res, { consumptions, meta });
});

exports.create = asyncHandler(async (req, res) => {
  created(res, { consumptions: await service.create(req.body, req.user.id) }, 'Consumption recorded');
});
