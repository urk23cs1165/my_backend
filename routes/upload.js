const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const { uploadFile } = require('../controllers/upload');

router.post('/', protect, upload.single('file'), uploadFile);

module.exports = router;