'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('../errors/AppError');

/**
 * JWT authentication middleware.
 * Expects: Authorization: Bearer <token>
 * Attaches the decoded payload to req.user on success.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'missing or invalid Authorization header — expected: Bearer <token>');
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { user_id, email, iat, exp }
    next();
  } catch (jwtErr) {
    const isExpired = jwtErr.name === 'TokenExpiredError';
    throw new AppError(401, isExpired ? 'token has expired — please log in again' : 'token is invalid or malformed');
  }
}

module.exports = authenticate;
