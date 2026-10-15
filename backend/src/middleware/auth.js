const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }
  const payload = jwt.verify(token, config.jwtSecret);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'UNAUTHENTICATED', 'Account not found or deactivated');
  }
  req.user = user;
  next();
});

// authorize(ACCESS.manageItems) or authorize('ADMIN', 'STOREKEEPER')
const authorize = (...roles) => {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    if (!allowed.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }
    next();
  };
};

module.exports = { authenticate, authorize };
