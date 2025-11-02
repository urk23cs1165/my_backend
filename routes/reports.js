const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  verifyReport,
} = require('../controllers/reports');

// Protect all routes
router.use(protect);

// Routes accessible by both users and admins
router.route('/')
  .get(getReports)
  .post(createReport);

router.route('/:id')
  .get(getReport)
  .put(updateReport)
  .delete(deleteReport);

// Admin only routes
router.put('/:id/verify', authorize('admin'), verifyReport);

module.exports = router;