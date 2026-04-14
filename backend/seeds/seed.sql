-- =============================================================
-- seeds/seed.sql
-- Seeds the database with initial test data.
-- Idempotent: uses ON CONFLICT DO NOTHING so it's safe to re-run.
-- =============================================================

-- 1. Insert test user
--    Password: password123  →  bcrypt hash (cost 12)
INSERT INTO users (id, name, email, password)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Test User',
  'test@example.com',
  '$2a$12$KIX/RxrMoq8p7FxVL1qEpuodRkwI5.XR2F3g8Vz3i0f3VxS5aaqNa'
)
ON CONFLICT (email) DO NOTHING;

-- 2. Insert test project
INSERT INTO projects (id, name, description, owner_id)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'Sample Project',
  'A demonstration project created by the seed script.',
  'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT DO NOTHING;

-- 3. Insert 3 tasks with different statuses
INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id)
VALUES
  (
    'c0000000-0000-0000-0000-000000000001',
    'Set up project repository',
    'Initialize git repo, add .gitignore and README.',
    'todo',
    'high',
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'Design database schema',
    'Create ERD and write migration files.',
    'in_progress',
    'medium',
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001'
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'Write API specification',
    'Document all endpoints in OpenAPI format.',
    'done',
    'low',
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001'
  )
ON CONFLICT DO NOTHING;
