const express = require('express');
const router = express.Router();
const { requireAuth, requirePermission } = require('../middleware/auth');
const {
  getTeams, getTeam, createTeam, updateTeam, deleteTeam,
  addMembers, removeMembers, getHierarchy,
} = require('../controllers/teamController');

router.use(requireAuth);

router.get('/hierarchy', getHierarchy);
router.get('/', getTeams);
router.post('/', requirePermission('manage_teams'), createTeam);
router.get('/:id', getTeam);
router.patch('/:id', requirePermission('manage_teams'), updateTeam);
router.delete('/:id', requirePermission('manage_teams'), deleteTeam);
router.post('/:id/members', requirePermission('manage_teams'), addMembers);
router.delete('/:id/members', requirePermission('manage_teams'), removeMembers);

module.exports = router;
