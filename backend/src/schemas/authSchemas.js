'use strict';

const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(1, 'name is required').openapi({ example: 'Alice Doe' }),
  email: z.string().email('must be a valid email').openapi({ example: 'alice@example.com' }),
  password: z.string().min(8, 'password must be at least 8 characters').openapi({ example: 'password123' }),
});

const loginSchema = z.object({
  email: z.string().email('must be a valid email').openapi({ example: 'alice@example.com' }),
  password: z.string().min(1, 'password is required').openapi({ example: 'password123' }),
});

module.exports = { registerSchema, loginSchema };
