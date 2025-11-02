const Report = require('../models/Report');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get all reports
// @route   GET /api/reports
// @access  Private
exports.getReports = asyncHandler(async (req, res, next) => {
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];
  removeFields.forEach(param => delete reqQuery[param]);

  // If user is not admin, only show their reports
  if (req.user.role !== 'admin') {
    reqQuery.userId = req.user.id;
  }

  // Create query string
  let queryStr = JSON.stringify(reqQuery);
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Finding resource
  query = Report.find(JSON.parse(queryStr));

  // Select Fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Report.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Populate user details
  query = query.populate({
    path: 'userId',
    select: 'name email'
  });

  // Executing query
  const reports = await query;

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: reports.length,
    pagination,
    data: reports
  });
});

// @desc    Get single report
// @route   GET /api/reports/:id
// @access  Private
exports.getReport = asyncHandler(async (req, res, next) => {
  const report = await Report.findById(req.params.id).populate({
    path: 'userId',
    select: 'name email'
  });

  if (!report) {
    return next(new ErrorResponse(`Report not found with id of ${req.params.id}`, 404));
  }

  // Make sure user is report owner or admin
  if (report.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`Not authorized to access this report`, 401));
  }

  res.status(200).json({
    success: true,
    data: report
  });
});

// @desc    Create new report
// @route   POST /api/reports
// @access  Private
exports.createReport = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.userId = req.user.id;

  const report = await Report.create(req.body);

  res.status(201).json({
    success: true,
    data: report
  });
});

// @desc    Update report
// @route   PUT /api/reports/:id
// @access  Private
exports.updateReport = asyncHandler(async (req, res, next) => {
  let report = await Report.findById(req.params.id);

  if (!report) {
    return next(new ErrorResponse(`Report not found with id of ${req.params.id}`, 404));
  }

  // Make sure user is report owner
  if (report.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`Not authorized to update this report`, 401));
  }

  report = await Report.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: report
  });
});

// @desc    Delete report
// @route   DELETE /api/reports/:id
// @access  Private
exports.deleteReport = asyncHandler(async (req, res, next) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    return next(new ErrorResponse(`Report not found with id of ${req.params.id}`, 404));
  }

  // Make sure user is report owner or admin
  if (report.userId.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse(`Not authorized to delete this report`, 401));
  }

  await report.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Verify report
// @route   PUT /api/reports/:id/verify
// @access  Private/Admin
exports.verifyReport = asyncHandler(async (req, res, next) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    return next(new ErrorResponse(`Report not found with id of ${req.params.id}`, 404));
  }

  report.status = req.body.status;
  report.verifiedBy = req.user.id;
  report.verifiedAt = Date.now();

  await report.save();

  res.status(200).json({
    success: true,
    data: report
  });
});