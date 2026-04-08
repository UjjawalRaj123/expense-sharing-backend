const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  registerUser,
  loginUser,
  getCurrentUser,
  getUserById,
  getAllUsers,
} = require('../controllers/userController');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.get('/me', authenticate, getCurrentUser);
router.get('/', authenticate, getAllUsers);
router.get('/:id', authenticate, getUserById);

module.exports = router;
