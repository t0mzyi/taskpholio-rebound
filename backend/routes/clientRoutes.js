const express = require('express');
const router = express.Router();
const {
  createClient,
  getClients,
  getClient,
  updateClient,
  deleteClient,
  activateClient,
  getPortalTasks,
  getPortalProfile,
  getPortalProjects,
  getPortalAgreements,
  getPortalMessages,
  getClientMessages,
  createProject,
  getProjects,
  updateProject,
  createAgreement,
  getAgreements,
  updateAgreement,
  getPortalMeetings,
  requestPortalMeeting,
  getClientMeetings,
  createClientMeeting,
  approveClientMeeting
} = require('../controllers/clientController');
const { requireAuth } = require('../middleware/auth');

// Public routes for the client portal (Critical: Define /portal before /:id)
router.post('/activate', activateClient);
router.get('/portal/tasks', getPortalTasks);
router.get('/portal/profile', getPortalProfile);
router.get('/portal/projects', getPortalProjects);
router.get('/portal/agreements', getPortalAgreements);
router.get('/portal/messages', getPortalMessages);
router.get('/portal/meetings', getPortalMeetings);
router.post('/portal/meetings', requestPortalMeeting);

// Protected routes (Admin functionality)
router.use(requireAuth);

router.route('/')
  .post(createClient)
  .get(getClients);

router.get('/:id/messages', getClientMessages);

router.route('/:id')
  .get(getClient)
  .put(updateClient)
  .delete(deleteClient);

router.route('/:id/projects')
  .post(createProject)
  .get(getProjects);

router.patch('/:id/projects/:projectId', updateProject);

router.route('/:id/agreements')
  .post(createAgreement)
  .get(getAgreements);

router.patch('/:id/agreements/:agreementId', updateAgreement);

router.route('/:id/meetings')
  .get(getClientMeetings)
  .post(createClientMeeting);

router.patch('/:id/meetings/:meetingId/approve', approveClientMeeting);

module.exports = router;
