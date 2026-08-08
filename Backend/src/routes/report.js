const express = require('express');
const router = express.Router();
const { getReport } = require('../controllers/reportController');

router.get('/:id', getReport);
router.get('/shared/:id', getReport);

module.exports = router;
