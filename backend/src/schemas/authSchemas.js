'use strict';

const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email('must be a valid email'),
  password: z.string().min(8, 'password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('must be a valid email'),
  password: z.string().min(1, 'password is required'),
});

module.exports = { registerSchema, loginSchema };
