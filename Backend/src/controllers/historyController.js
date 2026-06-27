const Check = require('../models/Check');
const logger = require('../config/logger');

const ITEMS_PER_PAGE = 15;

/**
 * GET /api/history?page=N
 * Returns paginated history for the authenticated user.
 */
async function getHistory(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const userId = req.userId;

    const [checks, totalCount] = await Promise.all([
      Check.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE)
        .lean(),
      Check.countDocuments({ userId }),
    ]);

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

    res.json({
      checks,
      pagination: {
        page,
        totalPages,
        totalCount,
        perPage: ITEMS_PER_PAGE,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/history/:id
 * Returns a single check by ID (must belong to the authenticated user).
 */
async function getHistoryItem(req, res, next) {
  try {
    const check = await Check.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).lean();

    if (!check) {
      return res.status(404).json({ message: 'Check not found' });
    }

    res.json(check);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/history/:id
 * Deletes a check (must belong to the authenticated user).
 */
async function deleteHistoryItem(req, res, next) {
  try {
    const result = await Check.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!result) {
      return res.status(404).json({ message: 'Check not found' });
    }

    logger.info('Check deleted', { checkId: req.params.id, userId: req.userId });
    res.json({ message: 'Check deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getHistory, getHistoryItem, deleteHistoryItem };
