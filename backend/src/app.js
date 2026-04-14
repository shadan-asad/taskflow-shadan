'use strict';

/**
 * app.js — Express application factory.
 *
 * Keeping this separate from server.js makes the app fully testable
 * with supertest without binding to a port.
 */

const express = require('express');
const { z } = require('zod');
const { extendZodWithOpenApi } = require('@asteasolutions/zod-to-openapi');
extendZodWithOpenApi(z);

const pinoHttp = require('pino-http');
const logger = require('./logger');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const { standaloneRouter: taskStandaloneRoutes } = require('./routes/tasks');
const swaggerUi = require('swagger-ui-express');
const openApiSpec = require('./docs/openapiSpec');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Request logging ──────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} → ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} → ${res.statusCode} — ${err.message}`,
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Health check (unauthenticated) ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes (API Versioning) ───────────────────────────────────────────────
const v1Router = express.Router();

v1Router.use('/auth', authRoutes);
v1Router.use('/projects', projectRoutes);      // includes nested /projects/:id/tasks
v1Router.use('/tasks', taskStandaloneRoutes);  // standalone PATCH /tasks/:id  DELETE /tasks/:id

v1Router.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/api/v1', v1Router);

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

// ─── Centralised error handler (must be last) ─────────────────────────────────
app.use(errorHandler);

module.exports = app;
