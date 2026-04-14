'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const AppError = require('../errors/AppError');

/**
 * Sign a JWT for the given user.
 * Claims: { user_id, email }
 * Expiry: 24 hours
 * Secret: always from process.env — never hardcoded.
 */
function signToken(user) {
  return jwt.sign(
    { user_id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// ─────────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────────
async function register(req, res, next) {
  const { name, email, password } = req.body;

  try {
    // Hash password — bcrypt cost 12
    const hashed = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, hashed]
    );

    const user = rows[0];
    const token = signToken(user);

    return res.status(201).json({ token, user });
  } catch (err) {
    // pg unique-violation code → errorHandler converts to 409
    next(err);
  }
}

// ─────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────
async function login(req, res, next) {
  const { email, password } = req.body;

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, password FROM users WHERE email = $1`,
      [email]
    );

    const user = rows[0];

    // Constant-time comparison even if user not found (prevents timing attacks)
    const dummyHash = '$2a$12$invalidhashfortimingprotection000000000000000000000';
    const valid = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, dummyHash);

    if (!user || !valid) {
      throw new AppError(401, 'invalid credentials — email or password is incorrect');
    }

    const token = signToken(user);
    const { password: _pw, ...safeUser } = user; // strip password from response

    return res.status(200).json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };
