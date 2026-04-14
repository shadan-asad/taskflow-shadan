'use strict';

const logger = require('../logger');

/**
 * PostgreSQL error codes that map to specific HTTP responses.
 * Full list: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_ERROR_MAP = {
  '23505': { status: 409, message: 'a record with that value already exists' },
  '23503': { status: 409, message: 'referenced record does not exist' },
  '23502': { status: 400, message: 'a required field is missing' },
  '23514': { status: 400, message: 'value violates check constraint' },
  '22P02': { status: 400, message: 'invalid input syntax — check UUIDs and enum values' },
  '22007': { status: 400, message: 'invalid date/time format' },
  '42703': { status: 400, message: 'unknown column referenced in query' },
};

/**
 * Build a structured { error, fields } body from a ZodError.
 * Each failing field gets its own human-readable message.
 */
function formatZodError(err) {
  const fields = {};
  for (const issue of err.errors) {
    const key = issue.path.join('.') || '_root';
    // Use the first message per field (Zod can emit multiple)
    if (!fields[key]) fields[key] = issue.message;
  }
  return { error: 'validation failed', fields };
}

/**
 * Centralised error handler — must be registered AFTER all routes (4-arg signature).
 *
 * Priority order:
 *  1. AppError  — intentional operational errors thrown by controllers
 *  2. ZodError  — input validation failures
 *  3. pg errors — database constraint / syntax errors
 *  4. JSON parse errors — malformed request body
 *  5. Generic   — unexpected programming errors (500)
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // ── 1. Operational AppErrors ────────────────────────────────────────────────
  if (err.isOperational) {
    // Log at warn level — these are expected; no stack trace needed
    logger.warn(
      { status: err.statusCode, message: err.message, method: req.method, url: req.url },
      'Operational error'
    );
    return res.status(err.statusCode).json({ error: err.message });
  }

  // ── 2. Zod validation errors ─────────────────────────────────────────────────
  if (err.name === 'ZodError') {
    logger.warn({ url: req.url, issues: err.errors }, 'Validation error');
    return res.status(400).json(formatZodError(err));
  }

  // ── 3. PostgreSQL errors ─────────────────────────────────────────────────────
  if (err.code && PG_ERROR_MAP[err.code]) {
    const { status, message } = PG_ERROR_MAP[err.code];

    // For unique-violation, try to extract the conflicting field name from the error detail
    let finalMessage = message;
    if (err.code === '23505' && err.detail) {
      // pg detail looks like: Key (email)=(foo@bar.com) already exists.
      const match = err.detail.match(/Key \(([^)]+)\)/);
      if (match) finalMessage = `${match[1]} is already in use`;
    }

    logger.warn({ pgCode: err.code, detail: err.detail, url: req.url }, 'Database constraint error');
    return res.status(status).json({ error: finalMessage });
  }

  // ── 4. Malformed JSON body ───────────────────────────────────────────────────
  if (err.type === 'entity.parse.failed') {
    logger.warn({ url: req.url }, 'Invalid JSON body');
    return res.status(400).json({ error: 'request body contains invalid JSON' });
  }

  // ── 5. Unexpected / programming errors ──────────────────────────────────────
  // Log full stack — these represent bugs that need to be fixed
  logger.error({ err, method: req.method, url: req.url }, 'Unexpected error');
  return res.status(500).json({ error: 'internal server error' });
}

module.exports = errorHandler;
