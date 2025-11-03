const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Register user
exports.register = async (req, res) => {
  try {
    console.log('Registration attempt:', { 
      ...req.body,
      password: req.body.password ? '[HIDDEN]' : undefined 
    });

    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      console.log('Missing required fields:', {
        hasName: !!name,
        hasEmail: !!email,
        hasPassword: !!password,
        hasRole: !!role
      });
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, password, and role'
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      console.log('User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email address'
      });
    }

    // Validate role
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be either "user" or "admin"'
      });
    }

    // Create user
    user = await User.create({
      name,
      email,
      password,
      role
    });

    // Create token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || '1a27ddd24c6db7594643a64cf5a3a70c9c230dadf2305dfd8992496739f963fe',
      { expiresIn: '30d' }
    );

    console.log('Registration successful:', {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      hasToken: !!token
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    } catch (error) {
      console.error('Registration error:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        errors: error.errors
      });

      // Handle mongoose validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        console.log('Validation error messages:', messages);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: messages
        });
      }

      // Handle mongoose duplicate key error
      if (error.code === 11000) {
        console.log('Duplicate email error');
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists'
        });
      }

      // Log the complete error details for debugging
      console.error('Unhandled registration error:', {
        error,
        body: req.body,
        headers: req.headers
      });

      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if role matches
    const { role } = req.body;
    if (role && user.role !== role) {
      return res.status(401).json({
        success: false,
        message: 'Invalid role for this user'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Create token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

// Get current logged in user
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        verified: user.verified,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user information',
      error: error.message
    });
  }
};

// Update user details
exports.updateDetails = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user details',
      error: error.message
    });
  }
};

// Update password
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    // Create new token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
};
