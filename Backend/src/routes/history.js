const express = require('express');
const router = express.Router();
const { getHistory, getHistoryItem, deleteHistoryItem } = require('../controllers/historyController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', getHistory);
router.get('/:id', getHistoryItem);
router.delete('/:id', deleteHistoryItem);

module.exports = router;
