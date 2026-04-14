'use strict';

/**
 * __tests__/api/v1/tasks.test.js
 * Integration tests for tasks CRUD, filters, and access control.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, closePool } = require('./helpers/db');

let ownerToken;
let otherToken;
let projectId;
let taskId;

async function registerAndLogin(email) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'User', email, password: 'testpass123' });
  return res.body.token;
}

beforeEach(async () => {
  await truncateAll();

  ownerToken = await registerAndLogin('owner@tasks.com');
  otherToken = await registerAndLogin('other@tasks.com');

  const projRes = await request(app)
    .post('/api/v1/projects')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: 'Task Test Project' });
  projectId = projRes.body.id;

  const taskRes = await request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ title: 'Initial Task', priority: 'high' });
  taskId = taskRes.body.id;
});

afterAll(closePool);

// ── GET /api/v1/projects/:id/tasks ───────────────────────────────────────────────────
describe('GET /api/v1/projects/:id/tasks', () => {
  it('200 — returns tasks with pagination', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.length).toBe(1);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  it('200 — filters by status', async () => {
    // The default task is 'todo'
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/tasks?status=in_progress`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it('404 — unknown project', async () => {
    const res = await request(app)
      .get('/api/v1/projects/00000000-0000-0000-0000-000000000000/tasks')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(404);
  });
});

// ── POST /api/v1/projects/:id/tasks ──────────────────────────────────────────────────
describe('POST /api/v1/projects/:id/tasks', () => {
  it('201 — creates task with defaults', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'New Task' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('todo');
    expect(res.body.priority).toBe('medium');
  });

  it('400 — rejects missing title', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ priority: 'low' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation failed');
  });
});

// ── PATCH /api/v1/tasks/:id ─────────────────────────────────────────────────────────
describe('PATCH /api/v1/tasks/:id', () => {
  it('200 — owner can update status', async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
    expect(res.body.updated_at).toBeDefined();
  });

  it('400 — rejects invalid status enum', async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'flying' });

    expect(res.status).toBe(400);
  });

  it('403 — non-member cannot update', async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ status: 'done' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('only the project owner or the task assignee can update this task');
  });
});

// ── DELETE /api/v1/tasks/:id ────────────────────────────────────────────────────────
describe('DELETE /api/v1/tasks/:id', () => {
  it('403 — non-member cannot delete task', async () => {
    const res = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('204 — owner can delete task', async () => {
    const res = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(204);
  });
});
