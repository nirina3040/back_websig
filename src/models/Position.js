class Position {
  constructor(pool) {
    this.pool = pool;
  }

  async save(deviceId, latitude, longitude, accuracy, speed, heading, altitude) {
    const query = `
      INSERT INTO positions (device_id, latitude, longitude, accuracy, speed, heading, altitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, latitude, longitude, timestamp
    `;
    const values = [deviceId, latitude, longitude, accuracy, speed, heading, altitude];
    const result = await this.pool.query(query, values);
    
    // Update device's last position
    await this.pool.query('UPDATE devices SET last_position_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
      [result.rows[0].id, deviceId]);
    
    return result.rows[0];
  }

  async getLastPosition(deviceId) {
    const query = `
      SELECT latitude, longitude, timestamp, speed, heading
      FROM positions
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [deviceId]);
    return result.rows[0];
  }

  async getHistory(deviceId, limit = 100) {
    const query = `
      SELECT latitude, longitude, timestamp, speed, heading, accuracy
      FROM positions
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await this.pool.query(query, [deviceId, limit]);
    return result.rows.reverse();
  }

  async getPositionsByDateRange(deviceId, startDate, endDate) {
    const query = `
      SELECT latitude, longitude, timestamp, speed, heading
      FROM positions
      WHERE device_id = $1 AND timestamp BETWEEN $2 AND $3
      ORDER BY timestamp ASC
    `;
    const result = await this.pool.query(query, [deviceId, startDate, endDate]);
    return result.rows;
  }
}

module.exports = Position;