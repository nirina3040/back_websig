const Device = require('../models/Device');
const Position = require('../models/Position');

class DeviceController {
  constructor(pool) {
    this.deviceModel = new Device(pool);
    this.positionModel = new Position(pool);
  }

  async getAllDevices(req, res) {
    try {
      const devices = await this.deviceModel.findByUserId(req.userId);
      res.json({
        success: true,
        devices
      });
    } catch (error) {
      console.error('Get devices error:', error);
      res.status(500).json({ error: 'Error fetching devices' });
    }
  }

  async registerDevice(req, res) {
    try {
      const { deviceUuid, deviceName } = req.body;
      
      if (!deviceUuid || !deviceName) {
        return res.status(400).json({ error: 'Device UUID and name are required' });
      }
      
      // Check if device already exists
      const existingDevice = await this.deviceModel.findByUuid(deviceUuid);
      if (existingDevice) {
        return res.status(400).json({ error: 'Device already registered' });
      }
      
      const device = await this.deviceModel.create(deviceUuid, deviceName, req.userId);
      
      res.status(201).json({
        success: true,
        message: 'Device registered successfully',
        device
      });
    } catch (error) {
      console.error('Register device error:', error);
      res.status(500).json({ error: 'Error registering device' });
    }
  }

  async getDeviceDetails(req, res) {
    try {
      const { id } = req.params;
      const devices = await this.deviceModel.findByUserId(req.userId);
      const device = devices.find(d => d.id == id);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      const lastPosition = await this.positionModel.getLastPosition(device.id);
      const history = await this.positionModel.getHistory(device.id, 50);
      
      res.json({
        success: true,
        device: {
          ...device,
          last_position: lastPosition,
          history
        }
      });
    } catch (error) {
      console.error('Get device details error:', error);
      res.status(500).json({ error: 'Error fetching device details' });
    }
  }

  async updateDevice(req, res) {
    try {
      const { id } = req.params;
      const { deviceName } = req.body;
      
      // Verify device belongs to user
      const devices = await this.deviceModel.findByUserId(req.userId);
      const device = devices.find(d => d.id == id);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      // Update device name in database
      const query = 'UPDATE devices SET device_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
      const result = await this.deviceModel.pool.query(query, [deviceName, id]);
      
      res.json({
        success: true,
        message: 'Device updated successfully',
        device: result.rows[0]
      });
    } catch (error) {
      console.error('Update device error:', error);
      res.status(500).json({ error: 'Error updating device' });
    }
  }

  async deleteDevice(req, res) {
    try {
      const { id } = req.params;
      const device = await this.deviceModel.delete(id, req.userId);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      res.json({
        success: true,
        message: 'Device deleted successfully'
      });
    } catch (error) {
      console.error('Delete device error:', error);
      res.status(500).json({ error: 'Error deleting device' });
    }
  }

  async getDeviceHistory(req, res) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      
      // Verify device belongs to user
      const devices = await this.deviceModel.findByUserId(req.userId);
      const device = devices.find(d => d.id == id);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      const history = await this.positionModel.getHistory(id, limit);
      
      res.json({
        success: true,
        history
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ error: 'Error fetching position history' });
    }
  }

  async getDeviceLastPosition(req, res) {
    try {
      const { id } = req.params;
      
      // Verify device belongs to user
      const devices = await this.deviceModel.findByUserId(req.userId);
      const device = devices.find(d => d.id == id);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      const lastPosition = await this.positionModel.getLastPosition(id);
      
      res.json({
        success: true,
        position: lastPosition || null
      });
    } catch (error) {
      console.error('Get last position error:', error);
      res.status(500).json({ error: 'Error fetching last position' });
    }
  }
}

module.exports = DeviceController;