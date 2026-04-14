'use strict';

/**
 * server.js — HTTP server entry point.
 *
 * Loads environment variables, starts the Express app,
 * and registers graceful-shutdown handlers for SIGTERM / SIGINT.
 */

// Load .env in development (no-op in production where env is injected)
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch {
    // dotenv is optional — not listed as a prod dependency
  }
}

const app = require('./app');
const pool = require('./db');
const logger = require('./logger');

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, '🚀 TaskFlow API started');
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received — draining connections…');

  server.close(async () => {
    try {
      await pool.end();
      logger.info('Database pool closed. Goodbye.');
    } catch (err) {
      logger.error({ err }, 'Error closing database pool');
    }
    process.exit(0);
  });

  // Force-exit if graceful shutdown takes longer than 10 s
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});

module.exports = server; // exported for testing
