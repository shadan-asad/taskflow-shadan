-- Migration 002 — create projects
-- down
DROP INDEX IF EXISTS idx_projects_owner_id;
DROP TABLE IF EXISTS projects;
