class Device {
  constructor(pool) {
    this.pool = pool;
  }

  async create(deviceUuid, deviceName, userId) {
    const query = `
      INSERT INTO devices (device_uuid, device_name, user_id, status)
      VALUES ($1, $2, $3, 'offline')
      RETURNING id, device_uuid, device_name, status, created_at
    `;
    const values = [deviceUuid, deviceName, userId];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findByUserId(userId) {
    const query = `
      SELECT d.*, 
             (SELECT json_build_object('latitude', latitude, 'longitude', longitude, 'timestamp', timestamp)
              FROM positions 
              WHERE device_id = d.id 
              ORDER BY timestamp DESC 
              LIMIT 1) as last_position
      FROM devices d
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC
    `;
    const result = await this.pool.query(query, [userId]);
    return result.rows;
  }

  async findByUuid(deviceUuid) {
    const query = 'SELECT * FROM devices WHERE device_uuid = $1';
    const result = await this.pool.query(query, [deviceUuid]);
    return result.rows[0];
  }

  async updateStatus(deviceId, status) {
    const query = 'UPDATE devices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
    const result = await this.pool.query(query, [status, deviceId]);
    return result.rows[0];
  }

  async delete(deviceId, userId) {
    const query = 'DELETE FROM devices WHERE id = $1 AND user_id = $2 RETURNING id';
    const result = await this.pool.query(query, [deviceId, userId]);
    return result.rows[0];
  }
}

module.exports = Device;