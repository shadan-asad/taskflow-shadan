const { OpenApiGeneratorV3 } = require('@asteasolutions/zod-to-openapi');
const registry = require('./registry');
const { z } = require('zod');

// Import schemas directly to avoid getDefinition reliance
const { registerSchema, loginSchema } = require('../schemas/authSchemas');
const { createProjectSchema, updateProjectSchema } = require('../schemas/projectSchemas');
const { createTaskSchema, updateTaskSchema } = require('../schemas/taskSchemas');

// ─── Path Registrations ──────────────────────────────────────────────────────

// Register
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  summary: 'Register a new user',
  request: {
    body: {
      content: {
        'application/json': { schema: registerSchema },
      },
    },
  },
  responses: {
    201: { description: 'User created successfully' },
    400: { description: 'Validation error' },
    409: { description: 'Email already in use' },
  },
});

// Login
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Login to get access token',
  request: {
    body: {
      content: {
        'application/json': { schema: loginSchema },
      },
    },
  },
  responses: {
    200: { description: 'Login successful' },
    401: { description: 'Invalid credentials' },
  },
});

// Projects CRUD
registry.registerPath({
  method: 'get',
  path: '/api/v1/projects',
  summary: 'List my projects',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'List of projects' } },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/projects',
  summary: 'Create a project',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: createProjectSchema },
      },
    },
  },
  responses: { 201: { description: 'Project created' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/projects/{id}',
  summary: 'Get project details (with tasks)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: { 200: { description: 'Project details' } },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/projects/{id}',
  summary: 'Update project',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': { schema: updateProjectSchema },
      },
    },
  },
  responses: { 200: { description: 'Project updated' } },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/projects/{id}',
  summary: 'Delete project',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: { 204: { description: 'Project deleted' } },
});

// Tasks CRUD (Nested)
registry.registerPath({
  method: 'get',
  path: '/api/v1/projects/{id}/tasks',
  summary: 'List project tasks',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: { 200: { description: 'List of tasks' } },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/projects/{id}/tasks',
  summary: 'Create task in project',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': { schema: createTaskSchema },
      },
    },
  },
  responses: { 201: { description: 'Task created' } },
});

// Standalone Tasks
registry.registerPath({
  method: 'patch',
  path: '/api/v1/tasks/{id}',
  summary: 'Update task',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        'application/json': { schema: updateTaskSchema },
      },
    },
  },
  responses: { 200: { description: 'Task updated' } },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/tasks/{id}',
  summary: 'Delete task',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: { 204: { description: 'Task deleted' } },
});

// ─── Generate Specification ──────────────────────────────────────────────────

const generator = new OpenApiGeneratorV3(registry.definitions);

const openApiSpec = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    title: 'TaskFlow API',
    version: '1.0.0',
    description: 'A production-ready Task Management API',
  },
  servers: [{ url: '/api/v1' }],
});

module.exports = openApiSpec;
