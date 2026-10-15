const ok = (res, data = {}, message = 'Operation successful', status = 200) =>
  res.status(status).json({ success: true, message, data });

const created = (res, data = {}, message = 'Created successfully') => ok(res, data, message, 201);

module.exports = { ok, created };
