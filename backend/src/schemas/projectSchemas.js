'use strict';

const { z } = require('zod');

const uuidSchema = z.string().uuid('must be a valid UUID').openapi({ example: '123e4567-e89b-12d3-a456-426614174000' });

const createProjectSchema = z.object({
  name: z.string().min(1, 'name is required').openapi({ example: 'Project Alpha' }),
  description: z.string().optional().openapi({ example: 'Initial project for the taskflow application' }),
});

const updateProjectSchema = z.object({
  name: z.string().min(1, 'name must not be empty').optional().openapi({ example: 'Updated Project Name' }),
  description: z.string().optional().openapi({ example: 'Revised project description' }),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'at least one field must be provided' }
);

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
});

module.exports = { uuidSchema, createProjectSchema, updateProjectSchema, paginationSchema };
