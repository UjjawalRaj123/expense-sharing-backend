const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createSettlement,
  getGroupSettlements,
  deleteSettlement,
  getMySettlements,
} = require('../controllers/settlementController');

// Record a settlement for a group
router.post('/group/:groupId', authenticate, createSettlement);
// Get settlements for a group
router.get('/group/:groupId', authenticate, getGroupSettlements);
// Get settlements involving current user across all groups
router.get('/me', authenticate, getMySettlements);
// Delete a settlement
router.delete('/:id', authenticate, deleteSettlement);

module.exports = router;
