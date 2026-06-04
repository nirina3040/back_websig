const express = require('express');
const authMiddleware = require('../middleware/auth');
const DeviceController = require('../controllers/deviceController');

module.exports = (pool) => {
  const router = express.Router();
  const deviceController = new DeviceController(pool);

  // Get all devices
  router.get('/', authMiddleware, (req, res) => deviceController.getAllDevices(req, res));

  // Register new device
  router.post('/', authMiddleware, (req, res) => deviceController.registerDevice(req, res));

  // Get device details
  router.get('/:id', authMiddleware, (req, res) => deviceController.getDeviceDetails(req, res));

  // Update device
  router.put('/:id', authMiddleware, (req, res) => deviceController.updateDevice(req, res));

  // Delete device
  router.delete('/:id', authMiddleware, (req, res) => deviceController.deleteDevice(req, res));

  // Get device position history
  router.get('/:id/history', authMiddleware, (req, res) => deviceController.getDeviceHistory(req, res));

  // Get device last position
  router.get('/:id/last-position', authMiddleware, (req, res) => deviceController.getDeviceLastPosition(req, res));

  return router;
};