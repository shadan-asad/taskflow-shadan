'use strict';

const pool = require('../db');
const AppError = require('../errors/AppError');

// ─── helpers ──────────────────────────────────────────────────────────────────

async function findProject(id) {
  const { rows } = await pool.query(
    `SELECT id, name, description, owner_id, created_at FROM projects WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Fetches a project and confirms the caller is a member.
 * A "member" is the project owner OR a user who has at least one task
 * assigned to them in this project.
 *
 * Returns the project row on success.
 * Throws AppError 404 if the project doesn't exist.
 * Throws AppError 403 if the caller is not a member.
 */
async function assertProjectMember(projectId, userId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.owner_id, p.created_at,
            EXISTS (
              SELECT 1 FROM tasks t
              WHERE t.project_id = p.id AND t.assignee_id = $2
            ) AS is_assignee
     FROM projects p
     WHERE p.id = $1`,
    [projectId, userId]
  );

  if (!rows.length) {
    throw new AppError(404, `project with id "${projectId}" does not exist`);
  }

  const project = rows[0];
  const isOwner    = project.owner_id === userId;
  const isAssignee = project.is_assignee;

  if (!isOwner && !isAssignee) {
    throw new AppError(403, 'you do not have access to this project');
  }

  // Remove the internal flag before returning the project
  delete project.is_assignee;
  return project;
}

// ─────────────────────────────────────────────
// GET /projects  (with pagination)
// Returns projects where caller is owner OR has an assigned task.
// ─────────────────────────────────────────────
async function listProjects(req, res, next) {
  const userId = req.user.user_id;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  try {
    // Count total for pagination metadata
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT p.id) AS total
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id AND t.assignee_id = $1
       WHERE p.owner_id = $1 OR t.id IS NOT NULL`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total);

    const { rows } = await pool.query(
      `SELECT DISTINCT p.id, p.name, p.description, p.owner_id, p.created_at
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id AND t.assignee_id = $1
       WHERE p.owner_id = $1 OR t.id IS NOT NULL
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.json({
      data: rows,
      pagination: { page, limit, total },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// POST /projects
// ─────────────────────────────────────────────
async function createProject(req, res, next) {
  const { name, description } = req.body;
  const ownerId = req.user.user_id;

  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, owner_id, created_at`,
      [name, description || null, ownerId]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// GET /projects/:id   (project + its tasks)
// ─────────────────────────────────────────────
async function getProject(req, res, next) {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    const project = await assertProjectMember(id, userId);

    const { rows: tasks } = await pool.query(
      `SELECT id, title, description, status, priority,
              project_id, assignee_id, due_date, created_at, updated_at
       FROM tasks
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    return res.json({ ...project, tasks });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// PATCH /projects/:id   (owner only)
// ─────────────────────────────────────────────
async function updateProject(req, res, next) {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    const project = await findProject(id);
    if (!project) throw new AppError(404, `project with id "${id}" does not exist`);
    if (project.owner_id !== userId) throw new AppError(403, 'only the project owner can update this project');

    // Build SET clause dynamically from whitelisted fields
    const allowed = ['name', 'description'];
    const updates = [];
    const values = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        values.push(req.body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      throw new AppError(400, 'request body must include at least one of: name, description');
    }

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE projects SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, name, description, owner_id, created_at`,
      values
    );

    return res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// DELETE /projects/:id   (owner only, cascades)
// ─────────────────────────────────────────────
async function deleteProject(req, res, next) {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    const project = await findProject(id);
    if (!project) throw new AppError(404, `project with id "${id}" does not exist`);
    if (project.owner_id !== userId) throw new AppError(403, 'only the project owner can delete this project');

    await pool.query(`DELETE FROM projects WHERE id = $1`, [id]);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// GET /projects/:id/stats   (bonus)
// ─────────────────────────────────────────────
async function getProjectStats(req, res, next) {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    await assertProjectMember(id, userId);

    // Aggregate by status
    const { rows: statusRows } = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM tasks WHERE project_id = $1
       GROUP BY status`,
      [id]
    );

    const by_status = { todo: 0, in_progress: 0, done: 0 };
    for (const row of statusRows) {
      by_status[row.status] = parseInt(row.count);
    }

    // Aggregate by assignee
    const { rows: assigneeRows } = await pool.query(
      `SELECT t.assignee_id, u.name, COUNT(*) AS count
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = $1 AND t.assignee_id IS NOT NULL
       GROUP BY t.assignee_id, u.name
       ORDER BY count DESC`,
      [id]
    );

    const by_assignee = assigneeRows.map((r) => ({
      assignee_id: r.assignee_id,
      name: r.name,
      count: parseInt(r.count),
    }));

    return res.json({ by_status, by_assignee });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProjects, createProject, getProject, updateProject, deleteProject, getProjectStats };
