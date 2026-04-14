'use strict';

const { z } = require('zod');

const taskStatusEnum = z.enum(['todo', 'in_progress', 'done']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high']);

const createTaskSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().optional(),
  priority: taskPriorityEnum.default('medium'),
  assignee_id: z.string().uuid('assignee_id must be a valid UUID').optional().nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'due_date must be a valid ISO date (YYYY-MM-DD)')
    .optional()
    .nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1, 'title must not be empty').optional(),
  description: z.string().optional().nullable(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assignee_id: z.string().uuid('assignee_id must be a valid UUID').optional().nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'due_date must be a valid ISO date (YYYY-MM-DD)')
    .optional()
    .nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'at least one field must be provided' }
);

const taskFilterSchema = z.object({
  status: taskStatusEnum.optional(),
  assignee: z.string().uuid('assignee must be a valid UUID').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { createTaskSchema, updateTaskSchema, taskFilterSchema };
