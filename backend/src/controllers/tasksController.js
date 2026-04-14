'use strict';

const pool = require('../db');
const AppError = require('../errors/AppError');

// ─── helpers ──────────────────────────────────────────────────────────────────

async function findTask(id) {
  const { rows } = await pool.query(
    `SELECT t.*, p.owner_id AS project_owner_id
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1`,
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
    `SELECT p.id, p.name, p.owner_id,
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

  return project;
}

// ─────────────────────────────────────────────
// GET /projects/:id/tasks  (with filters + pagination)
// ─────────────────────────────────────────────
async function listTasks(req, res, next) {
  const { id: projectId } = req.params;
  const userId = req.user.user_id;

  try {
    // Confirm project exists AND caller is a member
    await assertProjectMember(projectId, userId);

    // Parse & validate query params
    const status = req.query.status || null;
    const assignee = req.query.assignee || null;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const conditions = ['t.project_id = $1'];
    const values = [projectId];

    if (status) {
      values.push(status);
      conditions.push(`t.status = $${values.length}`);
    }
    if (assignee) {
      values.push(assignee);
      conditions.push(`t.assignee_id = $${values.length}`);
    }

    const where = conditions.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM tasks t WHERE ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].total);

    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.priority,
              t.project_id, t.assignee_id, t.due_date, t.created_at, t.updated_at
       FROM tasks t
       WHERE ${where}
       ORDER BY t.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
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
// POST /projects/:id/tasks
// ─────────────────────────────────────────────
async function createTask(req, res, next) {
  const { id: projectId } = req.params;
  const userId = req.user.user_id;
  const { title, description, priority, assignee_id, due_date } = req.body;

  try {
    // Confirm project exists AND caller is the owner (only owners can create tasks)
    const project = await assertProjectMember(projectId, userId);

    if (project.owner_id !== userId) {
      throw new AppError(403, 'only the project owner can create tasks in this project');
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks
         (title, description, status, priority, project_id, assignee_id, due_date)
       VALUES ($1, $2, 'todo', $3, $4, $5, $6)
       RETURNING id, title, description, status, priority,
                 project_id, assignee_id, due_date, created_at, updated_at`,
      [
        title,
        description || null,
        priority || 'medium',
        projectId,
        assignee_id || null,
        due_date || null,
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// PATCH /tasks/:id
// Any project member (owner OR assignee) can update.
// ─────────────────────────────────────────────
async function updateTask(req, res, next) {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    const task = await findTask(id);
    if (!task) throw new AppError(404, `task with id "${id}" does not exist`);

    // Access check: must be project owner or current assignee
    const isOwner = task.project_owner_id === userId;
    const isAssignee = task.assignee_id === userId;
    if (!isOwner && !isAssignee) {
      throw new AppError(403, 'only the project owner or the task assignee can update this task');
    }

    // Build dynamic SET clause
    const allowed = ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date'];
    const updates = [];
    const values = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        values.push(req.body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      throw new AppError(400, 'request body must include at least one of: title, description, status, priority, assignee_id, due_date');
    }

    // Always refresh updated_at
    updates.push(`updated_at = NOW()`);

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE tasks SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, title, description, status, priority,
                 project_id, assignee_id, due_date, created_at, updated_at`,
      values
    );

    return res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// DELETE /tasks/:id
// Only project owner OR task assignee can delete.
// ─────────────────────────────────────────────
async function deleteTask(req, res, next) {
  const { id } = req.params;
  const userId = req.user.user_id;

  try {
    const task = await findTask(id);
    if (!task) throw new AppError(404, `task with id "${id}" does not exist`);

    const isOwner = task.project_owner_id === userId;
    const isAssignee = task.assignee_id === userId;
    if (!isOwner && !isAssignee) {
      throw new AppError(403, 'only the project owner or the task assignee can delete this task');
    }

    await pool.query(`DELETE FROM tasks WHERE id = $1`, [id]);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listTasks, createTask, updateTask, deleteTask };
