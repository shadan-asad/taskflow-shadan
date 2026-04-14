'use strict';

/**
 * __tests__/helpers/db.js
 *
 * Test database utilities — truncates tables between suites.
 * Requires TEST_DATABASE_URL env var to point at a separate test DB.
 */

const pool = require('../../src/db');

async function truncateAll() {
  await pool.query(`
    TRUNCATE tasks, projects, users RESTART IDENTITY CASCADE
  `);
}

async function closePool() {
  await pool.end();
}

module.exports = { truncateAll, closePool };
