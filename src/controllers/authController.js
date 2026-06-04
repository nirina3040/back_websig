const User = require('../models/User');
const { validationResult } = require('express-validator');

class AuthController {
  constructor(pool) {
    this.userModel = new User(pool);
  }

  async register(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await this.userModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      
      const user = await this.userModel.create(username, email, password);
      const token = this.userModel.generateToken(user.id);
      
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          created_at: user.created_at
        },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Error creating user' });
    }
  }

  async login(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;
      const user = await this.userModel.findByEmail(email);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      const isValidPassword = await this.userModel.validatePassword(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      const token = this.userModel.generateToken(user.id);
      await this.userModel.updateLastLogin(user.id);
      
      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Error during login' });
    }
  }

  async getProfile(req, res) {
    try {
      const user = await this.userModel.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Error fetching profile' });
    }
  }

  async logout(req, res) {
    try {
      // In a real implementation, you might blacklist the token
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      res.status(500).json({ error: 'Error during logout' });
    }
  }
}

module.exports = AuthController;