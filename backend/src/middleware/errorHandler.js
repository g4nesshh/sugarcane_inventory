const { ZodError } = require('zod');
const jwt = require('jsonwebtoken');
const { Prisma } = require('@prisma/client');
const AppError = require('../utils/AppError');
const config = require('../config/env');

const notFound = (req, res, next) =>
  next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details;

  if (err instanceof AppError) {
    ({ statusCode: status, code, message } = err);
  } else if (err instanceof ZodError) {
    status = 400; code = 'VALIDATION_ERROR'; message = 'Validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof jwt.TokenExpiredError) {
    status = 401; code = 'TOKEN_EXPIRED'; message = 'Session expired, please log in again';
  } else if (err instanceof jwt.JsonWebTokenError) {
    status = 401; code = 'INVALID_TOKEN'; message = 'Invalid authentication token';
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') { status = 409; code = 'DUPLICATE_RECORD'; message = 'A record with this value already exists'; }
    else if (err.code === 'P2025') { status = 404; code = 'NOT_FOUND'; message = 'Record not found'; }
    else if (err.code === 'P2003') { status = 409; code = 'REFERENCE_CONFLICT'; message = 'Record is referenced by other data'; }
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'Malformed JSON body';
  }

  if (status === 500) console.error(err);

  const body = { success: false, message, error: code };
  if (details) body.details = details;
  if (status === 500 && config.nodeEnv !== 'production') body.debug = err.message;
  res.status(status).json(body);
};

module.exports = { notFound, errorHandler };
