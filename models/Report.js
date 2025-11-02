const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  location: {
    type: String,
    required: [true, 'Please add a location']
  },
  streetName: String,
  area: String,
  city: String,
  pincode: String,
  locationDetails: {
    streetName: String,
    landmark: String,
    area: String,
    city: String,
    pincode: String,
    description: String
  },
  type: {
    type: String,
    enum: ['hazard', 'maintenance', 'other'],
    default: 'hazard'
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'in-progress', 'resolved', 'rejected'],
    default: 'pending'
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  verificationHistory: [{
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    adminId: {
      type: String,
      ref: 'User'
    },
    comment: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  verifiedBy: {
    type: String,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  adminComments: {
    type: String
  },
  image: {
    type: String
  },
  userId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
reportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Report', reportSchema);
