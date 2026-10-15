const service = require('../services/inventory.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { inventory, meta } = await service.list(req.query);
  ok(res, { inventory, meta });
});

exports.getByItem = asyncHandler(async (req, res) => {
  ok(res, await service.getByItem(req.params.itemId));
});
