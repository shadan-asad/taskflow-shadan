'use strict';

const { OpenAPIRegistry } = require('@asteasolutions/zod-to-openapi');
const { registerSchema, loginSchema } = require('../schemas/authSchemas');
const { createProjectSchema, updateProjectSchema } = require('../schemas/projectSchemas');
const { createTaskSchema, updateTaskSchema } = require('../schemas/taskSchemas');

const registry = new OpenAPIRegistry();

// Register independent schemas (for re-use in paths)
registry.register('RegisterRequest', registerSchema);
registry.register('LoginRequest', loginSchema);
registry.register('CreateProjectRequest', createProjectSchema);
registry.register('UpdateProjectRequest', updateProjectSchema);
registry.register('CreateTaskRequest', createTaskSchema);
registry.register('UpdateTaskRequest', updateTaskSchema);

// Security schemes
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

module.exports = registry;
