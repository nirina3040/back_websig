-- Create database
CREATE DATABASE IF NOT EXISTS websig_db;

-- Connect to database
\c websig_db;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    device_uuid VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'offline',
    last_position_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    speed DECIMAL(10, 2),
    heading DECIMAL(10, 2),
    altitude DECIMAL(10, 2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_uuid ON devices(device_uuid);
CREATE INDEX IF NOT EXISTS idx_positions_device_id ON positions(device_id);
CREATE INDEX IF NOT EXISTS idx_positions_timestamp ON positions(timestamp);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for devices table
CREATE TRIGGER update_devices_updated_at 
    BEFORE UPDATE ON devices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for latest positions
CREATE OR REPLACE VIEW latest_positions AS
SELECT DISTINCT ON (device_id) 
    d.id as device_id,
    d.device_uuid,
    d.device_name,
    d.status,
    p.latitude,
    p.longitude,
    p.speed,
    p.heading,
    p.timestamp,
    u.id as user_id,
    u.username
FROM devices d
LEFT JOIN positions p ON d.id = p.device_id
LEFT JOIN users u ON d.user_id = u.id
ORDER BY device_id, p.timestamp DESC;

-- Insert demo user (password: demo123)
INSERT INTO users (username, email, password_hash) 
VALUES ('demo', 'demo@example.com', '$2a$10$r0GJZqL3Y8Z9qL3Y8Z9qLuY8Z9qL3Y8Z9qL3Y8Z9qL3Y8Z9qL3Y8Z9qL3Y') 
ON CONFLICT (email) DO NOTHING;

