const authService = require('../services/auth.service');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');

exports.login = asyncHandler(async (req, res) => {
  ok(res, await authService.login(req.body), 'Login successful');
});

exports.register = asyncHandler(async (req, res) => {
  created(res, { user: await authService.register(req.body) }, 'User created');
});

exports.me = asyncHandler(async (req, res) => {
  ok(res, { user: await authService.getProfile(req.user.id) });
});
