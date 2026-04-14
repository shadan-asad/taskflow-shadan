'use strict';

/**
 * __tests__/auth.test.js
 * Integration tests for POST /api/v1/auth/register and POST /api/v1/auth/login.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, closePool } = require('./helpers/db');

beforeEach(truncateAll);
afterAll(closePool);

describe('POST /api/v1/auth/register', () => {
  const valid = { name: 'Alice', email: 'alice@example.com', password: 'password123' };

  it('201 — returns token and user on valid payload', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('400 — rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...valid, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed');
    expect(res.body.fields).toHaveProperty('email');
  });

  it('400 — rejects short password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...valid, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty('password');
  });

  it('409 — rejects duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(valid);
    const res = await request(app).post('/api/v1/auth/register').send(valid);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email is already in use');
  });
});

describe('POST /api/v1/auth/login', () => {
  const creds = { name: 'Bob', email: 'bob@example.com', password: 'securepass' };

  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send(creds);
  });

  it('200 — returns token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: creds.email, password: creds.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(creds.email);
  });

  it('401 — rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: creds.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials — email or password is incorrect');
  });

  it('401 — rejects unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.com', password: 'whatever123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials — email or password is incorrect');
  });
});
