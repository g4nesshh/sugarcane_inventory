const service = require('../services/dashboard.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

exports.summary = asyncHandler(async (req, res) => {
  ok(res, await service.getSummary());
});

exports.stockMovement = asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
  ok(res, { series: await service.getStockMovementSeries(days) });
});

exports.lowStock = asyncHandler(async (req, res) => {
  const { items, meta } = await service.getLowStock(req.query);
  ok(res, { items, meta });
});
