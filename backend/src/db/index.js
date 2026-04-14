'use strict';

const { Pool } = require('pg');
const logger = require('../logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep connection pool reasonable for production
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle pg client');
});

pool.on('connect', () => {
  logger.debug('New pg client connected');
});

module.exports = pool;
