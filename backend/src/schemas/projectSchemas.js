'use strict';

const { z } = require('zod');

const uuidSchema = z.string().uuid('must be a valid UUID');

const createProjectSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1, 'name must not be empty').optional(),
  description: z.string().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'at least one field must be provided' }
);

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { uuidSchema, createProjectSchema, updateProjectSchema, paginationSchema };
