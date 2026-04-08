const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createExpense,
  getGroupExpenses,
  getExpenseById,
  deleteExpense,
  addPaymentToExpense,
  getExpensePayments,
  getMyExpenses,
} = require('../controllers/expenseController');

// All routes are protected
router.post('/', authenticate, createExpense);
router.get('/me', authenticate, getMyExpenses);
router.get('/group/:groupId', authenticate, getGroupExpenses);
router.get('/:id', authenticate, getExpenseById);
router.delete('/:id', authenticate, deleteExpense);

// Payment tracking routes
router.post('/:expenseId/payments', authenticate, addPaymentToExpense);
router.get('/:expenseId/payments', authenticate, getExpensePayments);

module.exports = router;
