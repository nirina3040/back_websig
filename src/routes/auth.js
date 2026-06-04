const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

module.exports = (pool) => {
  const router = express.Router();
  const authController = new AuthController(pool);

  // Register
  router.post('/register', [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ], (req, res) => authController.register(req, res));

  // Login
  router.post('/login', [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
  ], (req, res) => authController.login(req, res));

  // Get profile (protected)
  router.get('/profile', authMiddleware, (req, res) => authController.getProfile(req, res));

  // Logout
  router.post('/logout', authMiddleware, (req, res) => authController.logout(req, res));

  return router;
};