const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getGroupBalances,
  getUserBalance,
  getOverallUserBalance,
} = require('../controllers/balanceController');

// All routes are protected
router.get('/group/:groupId', authenticate, getGroupBalances);
// Overall balances for current user across all groups
router.get('/me', authenticate, getOverallUserBalance);
router.get('/group/:groupId/user/:userId', authenticate, getUserBalance);

module.exports = router;
