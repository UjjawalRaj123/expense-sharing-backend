const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createGroup,
  getUserGroups,
  getGroupById,
  addMemberToGroup,
  deleteGroup,
} = require('../controllers/groupController');

// All routes are protected
router.post('/', authenticate, createGroup);
router.get('/', authenticate, getUserGroups);
router.get('/:id', authenticate, getGroupById);
router.post('/:groupId/members', authenticate, addMemberToGroup);
router.delete('/:groupId', authenticate, deleteGroup);

module.exports = router;
