'use strict';

const { Router } = require('express');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createProjectSchema, updateProjectSchema } = require('../schemas/projectSchemas');
const {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  getProjectStats,
} = require('../controllers/projectsController');

// Task routes that live under /projects/:id/tasks
const { nestedRouter: taskRoutes } = require('./tasks');

const router = Router();

// All project routes require authentication
router.use(authenticate);

router.get('/', listProjects);
router.post('/', validate(createProjectSchema), createProject);
router.get('/:id', getProject);
router.patch('/:id', validate(updateProjectSchema), updateProject);
router.delete('/:id', deleteProject);

// Bonus: stats endpoint
router.get('/:id/stats', getProjectStats);

// Mount task sub-routes: /projects/:id/tasks
router.use('/:id/tasks', taskRoutes);

module.exports = router;
