const service = require('../services/stockMovement.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

exports.list = asyncHandler(async (req, res) => {
  const { movements, meta } = await service.list(req.query);
  ok(res, { movements, meta });
});
