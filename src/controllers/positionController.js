const Position = require('../models/Position');
const Device = require('../models/Device');

class PositionController {
  constructor(pool) {
    this.positionModel = new Position(pool);
    this.deviceModel = new Device(pool);
  }

  async savePosition(req, res) {
    try {
      const { deviceId, latitude, longitude, accuracy, speed, heading, altitude } = req.body;
      
      if (!deviceId || !latitude || !longitude) {
        return res.status(400).json({ error: 'Device ID, latitude and longitude are required' });
      }
      
      // Verify device belongs to user
      const devices = await this.deviceModel.findByUserId(req.userId);
      const device = devices.find(d => d.id == deviceId);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      const position = await this.positionModel.save(
        deviceId, latitude, longitude, accuracy, speed, heading, altitude
      );
      
      res.status(201).json({
        success: true,
        message: 'Position saved successfully',
        position
      });
    } catch (error) {
      console.error('Save position error:', error);
      res.status(500).json({ error: 'Error saving position' });
    }
  }

  async getAllLastPositions(req, res) {
    try {
      const devices = await this.deviceModel.findByUserId(req.userId);
      const positions = [];
      
      for (const device of devices) {
        const lastPosition = await this.positionModel.getLastPosition(device.id);
        if (lastPosition) {
          positions.push({
            deviceId: device.id,
            deviceUuid: device.device_uuid,
            deviceName: device.device_name,
            status: device.status,
            ...lastPosition
          });
        }
      }
      
      res.json({
        success: true,
        positions
      });
    } catch (error) {
      console.error('Get all positions error:', error);
      res.status(500).json({ error: 'Error fetching positions' });
    }
  }

  async getPositionHistory(req, res) {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate, limit } = req.query;
      
      // Verify device belongs to user
      const devices = await this.deviceModel.findByUserId(req.userId);
      const device = devices.find(d => d.id == deviceId);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      let history;
      if (startDate && endDate) {
        history = await this.positionModel.getPositionsByDateRange(deviceId, startDate, endDate);
      } else {
        const limitNum = parseInt(limit) || 100;
        history = await this.positionModel.getHistory(deviceId, limitNum);
      }
      
      res.json({
        success: true,
        history
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ error: 'Error fetching position history' });
    }
  }

  async getLatestPosition(req, res) {
    try {
      const { deviceId } = req.params;
      
      // Verify device belongs to user
      const devices = await this.deviceModel.findByUserId(req.userId);
      const device = devices.find(d => d.id == deviceId);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      const position = await this.positionModel.getLastPosition(deviceId);
      
      res.json({
        success: true,
        position: position || null
      });
    } catch (error) {
      console.error('Get latest position error:', error);
      res.status(500).json({ error: 'Error fetching latest position' });
    }
  }

  async getStatistics(req, res) {
    try {
      const { deviceId } = req.params;
      
      // Verify device belongs to user
      const devices = await this.deviceModel.findByUserId(req.userId);
      const device = devices.find(d => d.id == deviceId);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      
      // Get statistics
      const totalQuery = 'SELECT COUNT(*) as total FROM positions WHERE device_id = $1';
      const totalResult = await this.positionModel.pool.query(totalQuery, [deviceId]);
      
      const todayQuery = `SELECT COUNT(*) as today FROM positions 
                          WHERE device_id = $1 AND DATE(timestamp) = CURRENT_DATE`;
      const todayResult = await this.positionModel.pool.query(todayQuery, [deviceId]);
      
      const avgSpeedQuery = 'SELECT AVG(speed) as avg_speed FROM positions WHERE device_id = $1 AND speed IS NOT NULL';
      const avgSpeedResult = await this.positionModel.pool.query(avgSpeedQuery, [deviceId]);
      
      res.json({
        success: true,
        statistics: {
          total_positions: parseInt(totalResult.rows[0].total),
          today_positions: parseInt(todayResult.rows[0].today),
          average_speed: parseFloat(avgSpeedResult.rows[0].avg_speed) || 0
        }
      });
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({ error: 'Error fetching statistics' });
    }
  }
}

module.exports = PositionController;