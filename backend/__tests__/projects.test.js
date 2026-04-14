'use strict';

/**
 * __tests__/api/v1/projects.test.js
 * Integration tests for /api/v1/projects CRUD + stats.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, closePool } = require('./helpers/db');

let token;
let token2;
let projectId;

async function registerAndLogin(email, password = 'testpass123') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'User', email, password });
  return res.body.token;
}

beforeEach(async () => {
  await truncateAll();
  token = await registerAndLogin('owner@example.com');
  token2 = await registerAndLogin('other@example.com');

  // Create a baseline project
  const res = await request(app)
    .post('/api/v1/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Project', description: 'For testing' });
  projectId = res.body.id;
});

afterAll(closePool);

// ── GET /api/v1/projects ─────────────────────────────────────────────────────────────
describe('GET /api/v1/projects', () => {
  it('200 — returns projects with pagination', async () => {
    const res = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('401 — rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/projects');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/projects ────────────────────────────────────────────────────────────
describe('POST /api/v1/projects', () => {
  it('201 — creates project with owner_id from token', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Project' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('New Project');
  });

  it('400 — rejects missing name', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'No name here' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed');
  });
});

// ── GET /api/v1/projects/:id ─────────────────────────────────────────────────────────
describe('GET /api/v1/projects/:id', () => {
  it('200 — returns project with tasks array', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tasks');
    expect(Array.isArray(res.body.tasks)).toBe(true);
  });

  it('404 — returns not found for unknown id', async () => {
    const res = await request(app)
      .get('/api/v1/projects/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/v1/projects/:id ───────────────────────────────────────────────────────
describe('PATCH /api/v1/projects/:id', () => {
  it('200 — owner can update project', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  it('403 — non-owner cannot update project', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('only the project owner can update this project');
  });
});

// ── GET /api/v1/projects/:id/stats ───────────────────────────────────────────────────
describe('GET /api/v1/projects/:id/stats', () => {
  it('200 — returns by_status and by_assignee', async () => {
    // Add a task first
    await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'A task' });

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('by_status');
    expect(res.body).toHaveProperty('by_assignee');
    expect(res.body.by_status).toHaveProperty('todo');
  });
});

// ── DELETE /api/v1/projects/:id ──────────────────────────────────────────────────────
describe('DELETE /api/v1/projects/:id', () => {
  it('403 — non-owner cannot delete project', async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(403);
  });

  it('204 — owner can delete project', async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});
