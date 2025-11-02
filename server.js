// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fileUpload = require('express-fileupload');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    'https://pathhole-2717e.web.app',
    'https://pathhole-2717e.firebaseapp.com',
    // Include localhost for development
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(fileUpload());

// Import routes
const authRoutes = require('./routes/auth');

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection with error handling
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      },
      dbName: 'smart_hazard_db'
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Create collections if they don't exist
    await conn.connection.db.createCollection('reports', {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["title", "description", "location"],
          properties: {
            title: {
              bsonType: "string",
              description: "must be a string and is required"
            },
            description: {
              bsonType: "string",
              description: "must be a string and is required"
            },
            location: {
              bsonType: "string",
              description: "must be a string and is required"
            }
          }
        }
      }
    });
    console.log('✅ Reports collection created/verified');

    await conn.connection.db.createCollection('users', {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["name", "email", "password"],
          properties: {
            name: {
              bsonType: "string",
              description: "must be a string and is required"
            },
            email: {
              bsonType: "string",
              description: "must be a string and is required"
            },
            password: {
              bsonType: "string",
              description: "must be a string and is required"
            },
            role: {
              bsonType: "string",
              enum: ["user", "admin", "government"],
              description: "must be one of: user, admin, government"
            }
          }
        }
      }
    });
    console.log('✅ Users collection created/verified');
  } catch (error) {
    if (error.code === 48) {
      console.log('✅ Collections already exist');
    } else {
      console.error(`❌ Database Error: ${error.message}`);
      process.exit(1);
    }
  }
};

// Connect to database
connectDB();

// Basic test routes
// File upload endpoint
app.post('/api/upload', async (req, res) => {
  try {
    console.log('📤 Received file upload request');
    
    if (!req.files || !req.files.file) {
      console.log('❌ No file received in request');
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const file = req.files.file;
    console.log('📁 File details:', {
      name: file.name,
      type: file.mimetype,
      size: file.size
    });
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log('❌ Invalid file type:', file.mimetype);
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPG, JPEG, and PNG files are allowed.'
      });
    }

    // Create a safe filename
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const uploadPath = path.join(__dirname, 'uploads', fileName);
    console.log('📂 Saving file to:', uploadPath);

    // Ensure uploads directory exists
    if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
      fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
    }

    // Move the file
    await file.mv(uploadPath);
    console.log(`✅ File uploaded successfully: ${fileName}`);

    // Construct absolute URL using the backend's domain
    const baseUrl = process.env.BACKEND_URL || 'https://my-backend-ov6w.onrender.com';
    const fileUrl = `${baseUrl}/uploads/${fileName}`;
    console.log('🔗 File URL:', fileUrl);

    res.json({
      success: true,
      url: fileUrl,
      fileName: fileName
    });
  } catch (error) {
    console.error('❌ File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file: ' + error.message
    });
  }
});

// Import models
const Report = require('./models/Report');
const User = require('./models/User');

// User registration endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    console.log('📝 Received registration data:', { name, email, role });

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user'
    });

    console.log('✅ User registered successfully:', {
      id: user._id,
      name: user.name,
      email: user.email
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
});

// User login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt for:', email);

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('✅ User logged in successfully:', {
      id: user._id,
      name: user.name,
      email: user.email
    });

    res.json({
      success: true,
      message: 'Logged in successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

// Report submission endpoint
app.post('/api/reports', async (req, res) => {
  try {
    console.log('📝 Received report data:', JSON.stringify(req.body, null, 2));
    
    // Basic validation
    if (!req.body.title || !req.body.description || !req.body.location) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields. Title, description, and location are required.'
      });
    }

    // Prepare report data
    const reportData = {
      title: req.body.title,
      description: req.body.description,
      location: req.body.location,
      locationDetails: req.body.locationDetails || {},
      type: req.body.type || 'hazard',
      status: 'pending',
      image: req.body.image || null,
      userId: req.body.userId || '655e1234abcd1234abcd1234', // Temporary user ID
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('📋 Prepared report data:', JSON.stringify(reportData, null, 2));

    // Create and save the report
    const newReport = new Report(reportData);
    const savedReport = await newReport.save();

    console.log('✅ Report saved successfully:', {
      id: savedReport._id,
      title: savedReport.title
    });

    res.status(201).json({
      success: true,
      message: 'Report saved successfully!',
      data: savedReport
    });
  } catch (error) {
    console.error('❌ Error saving report:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Error saving report: ' + (error.message || 'Unknown error')
    });
  }
});



// Get all reports endpoint
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    console.log(`✅ Retrieved ${reports.length} reports`);
    
    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
});

// Get single report endpoint
app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('❌ Error fetching report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: error.message
    });
  }
});

// Admin Routes

// Get report statistics for admin dashboard
app.get('/api/admin/reports/stats', async (req, res) => {
  try {
    const stats = await Report.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
            }
          },
          verified: {
            $sum: {
              $cond: [{ $eq: ['$status', 'verified'] }, 1, 0]
            }
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0]
            }
          }
        }
      }
    ]);

    console.log('📊 Generated report statistics:', stats[0] || { total: 0, pending: 0, verified: 0, rejected: 0 });

    res.json({
      success: true,
      data: stats[0] || { total: 0, pending: 0, verified: 0, rejected: 0 }
    });
  } catch (error) {
    console.error('❌ Error generating report statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating report statistics',
      error: error.message
    });
  }
});

// Admin verify/reject report endpoint
app.put('/api/admin/reports/:id/verify', async (req, res) => {
  try {
    const { status, adminComments } = req.body;
    const reportId = req.params.id;

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status. Must be either "approved" or "rejected"'
      });
    }

    const report = await Report.findById(reportId);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Update report verification status
    const updatedReport = await Report.findByIdAndUpdate(
      reportId,
      {
        status: status === 'approved' ? 'verified' : 'rejected',
        verificationStatus: status,
        verifiedBy: req.body.adminId,
        verifiedAt: new Date(),
        adminComments: adminComments || '',
        updatedAt: new Date()
      },
      { new: true }
    );

    console.log(`✅ Report ${reportId} verified as ${status}`);

    res.json({
      success: true,
      message: `Report ${status} successfully`,
      data: updatedReport
    });
  } catch (error) {
    console.error('❌ Error verifying report:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying report',
      error: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
