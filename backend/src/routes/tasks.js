'use strict';

const { Router } = require('express');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createTaskSchema, updateTaskSchema } = require('../schemas/taskSchemas');
const { listTasks, createTask, updateTask, deleteTask } = require('../controllers/tasksController');

// ─────────────────────────────────────────────
// Nested routes under /projects/:id/tasks
// Express mergeParams ensures :id is available in controller.
// ─────────────────────────────────────────────
const nestedRouter = Router({ mergeParams: true });

nestedRouter.use(authenticate);
nestedRouter.get('/', listTasks);
nestedRouter.post('/', validate(createTaskSchema), createTask);

// ─────────────────────────────────────────────
// Standalone task routes: /tasks/:id
// ─────────────────────────────────────────────
const standaloneRouter = Router();

standaloneRouter.use(authenticate);
standaloneRouter.patch('/:id', validate(updateTaskSchema), updateTask);
standaloneRouter.delete('/:id', deleteTask);

module.exports = { nestedRouter, standaloneRouter };
