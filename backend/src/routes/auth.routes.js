const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { ACCESS } = require('../config/permissions');
const { loginSchema, registerSchema } = require('../validators/auth.validator');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, try again later', error: 'RATE_LIMITED' },
});

router.post('/login', loginLimiter, validate(loginSchema), controller.login);
router.post('/register', authenticate, authorize(ACCESS.manageUsers), validate(registerSchema), controller.register);
router.get('/me', authenticate, controller.me);

module.exports = router;
