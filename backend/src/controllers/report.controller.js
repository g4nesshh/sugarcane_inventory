const service = require('../services/report.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { toCsv } = require('../utils/csv');

function respond(res, filename, { rows, summary }, format) {
  if (format === 'csv') {
    res.header('Content-Type', 'text/csv').attachment(`${filename}.csv`).send(toCsv(rows));
    return;
  }
  ok(res, { rows, summary });
}

exports.inventory = asyncHandler(async (req, res) => {
  const result = await service.inventoryReport(req.query);
  respond(res, 'inventory-report', result, req.query.format);
});

exports.purchases = asyncHandler(async (req, res) => {
  const result = await service.purchaseReport(req.query);
  respond(res, 'purchase-report', result, req.query.format);
});

exports.consumption = asyncHandler(async (req, res) => {
  const result = await service.consumptionReport(req.query);
  respond(res, 'consumption-report', result, req.query.format);
});

exports.stockMovement = asyncHandler(async (req, res) => {
  const result = await service.stockMovementReport(req.query);
  respond(res, 'stock-movement-report', result, req.query.format);
});
