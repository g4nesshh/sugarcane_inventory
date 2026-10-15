const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const prisma = require('../utils/prisma');
const AppError = require('../utils/AppError');

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt,
});

// Compared against when the email doesn't exist, so timing doesn't reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  if (user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated');

  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
  return { token, user: publicUser(user) };
}

async function register({ name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, passwordHash, role } });
  return publicUser(user);
}

async function getProfile(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return publicUser(user);
}

module.exports = { login, register, getProfile };
