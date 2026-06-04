const express = require('express');
const authMiddleware = require('../middleware/auth');
const PositionController = require('../controllers/positionController');

module.exports = (pool) => {
  const router = express.Router();
  const positionController = new PositionController(pool);

  // Save position (from mobile)
  router.post('/', authMiddleware, (req, res) => positionController.savePosition(req, res));

  // Get all last positions
  router.get('/last', authMiddleware, (req, res) => positionController.getAllLastPositions(req, res));

  // Get position history for a device
  router.get('/history/:deviceId', authMiddleware, (req, res) => positionController.getPositionHistory(req, res));

  // Get latest position for a device
  router.get('/latest/:deviceId', authMiddleware, (req, res) => positionController.getLatestPosition(req, res));

  // Get statistics for a device
  router.get('/statistics/:deviceId', authMiddleware, (req, res) => positionController.getStatistics(req, res));

  return router;
};