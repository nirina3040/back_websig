const jwt = require('jsonwebtoken');
const Device = require('../models/Device');
const Position = require('../models/Position');

module.exports = (io, pool) => {
  const deviceModel = new Device(pool);
  const positionModel = new Position(pool);
  
  // Store active connections
  const activeDevices = new Map();
  const activeUsers = new Map();

  // Middleware d'authentification
  io.use((socket, next) => {
    // Récupérer le token depuis auth ou handshake
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    console.log('🔐 Auth token received:', token ? 'Present' : 'Missing');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        console.log('✅ User authenticated:', socket.userId);
        next();
      } catch (err) {
        console.log('❌ JWT verification failed:', err.message);
        next(new Error('Authentication error'));
      }
    } else {
      console.log('❌ No token provided');
      next(new Error('Authentication required'));
    }
  });

  io.on('connection', (socket) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔌 New client connected:', socket.id);
    console.log('👤 User ID:', socket.userId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Handle device connection (mobile app)
    socket.on('device:connect', async (data) => {
      console.log('📱 Device connect request:', data);
      
      try {
        const { deviceUuid, deviceName } = data;
        
        if (!deviceUuid) {
          socket.emit('error', { message: 'Device UUID required' });
          return;
        }
        
        let device = await deviceModel.findByUuid(deviceUuid);
        
        if (!device) {
          console.log('❌ Device not found:', deviceUuid);
          socket.emit('error', { message: 'Device not registered' });
          return;
        }
        
        // Vérifier que l'appareil appartient à l'utilisateur
        if (device.user_id !== socket.userId) {
          console.log('❌ Device does not belong to user:', socket.userId);
          socket.emit('error', { message: 'Device not authorized' });
          return;
        }
        
        await deviceModel.updateStatus(device.id, 'online');
        
        activeDevices.set(deviceUuid, {
          socketId: socket.id,
          deviceId: device.id,
          deviceUuid,
          deviceName: deviceName || device.device_name
        });
        
        socket.deviceId = device.id;
        socket.deviceUuid = deviceUuid;
        socket.deviceName = deviceName || device.device_name;
        
        socket.emit('device:connected', { 
          success: true,
          message: 'Device connected successfully',
          deviceId: device.id,
          deviceUuid: deviceUuid
        });
        
        console.log(`✅ Device ${deviceUuid} (${device.device_name}) connected`);
        
        // Notifier les clients web que l'appareil est en ligne
        io.emit(`device:${deviceUuid}:status`, { 
          deviceUuid, 
          status: 'online',
          deviceName: device.device_name
        });
        
      } catch (error) {
        console.error('❌ Error in device connection:', error);
        socket.emit('error', { message: 'Connection failed: ' + error.message });
      }
    });

    // Handle location updates from mobile device
    socket.on('location:update', async (data) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📍 LOCATION UPDATE RECEIVED');
      console.log('📦 Data:', data);
      
      try {
        const { latitude, longitude, accuracy, speed, heading, altitude, timestamp, deviceUuid } = data;
        
        // Utiliser deviceUuid du message ou du socket
        const targetDeviceUuid = deviceUuid || socket.deviceUuid;
        
        if (!socket.deviceId && !targetDeviceUuid) {
          console.log('❌ No device identified');
          socket.emit('error', { message: 'Device not identified' });
          return;
        }
        
        // Récupérer l'appareil si nécessaire
        let deviceId = socket.deviceId;
        let deviceUuidValue = socket.deviceUuid;
        
        if (!deviceId && targetDeviceUuid) {
          const device = await deviceModel.findByUuid(targetDeviceUuid);
          if (device) {
            deviceId = device.id;
            deviceUuidValue = device.device_uuid;
          }
        }
        
        if (!deviceId) {
          console.log('❌ Cannot find device');
          socket.emit('error', { message: 'Device not found' });
          return;
        }
        
        console.log(`📍 Saving position for device ${deviceUuidValue} (ID: ${deviceId})`);
        console.log(`📍 Coordinates: ${latitude}, ${longitude}`);
        
        // Save position to database
        const position = await positionModel.save(
          deviceId,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          altitude
        );
        
        console.log(`✅ Position saved with ID: ${position.id}`);
        
        // Prepare broadcast data
        const broadcastData = {
          deviceUuid: deviceUuidValue,
          deviceId: deviceId,
          deviceName: socket.deviceName || 'Mobile Device',
          latitude: latitude,
          longitude: longitude,
          accuracy: accuracy,
          speed: speed,
          heading: heading,
          altitude: altitude,
          timestamp: timestamp || position.timestamp
        };
        
        // Broadcast to all web clients watching this device
        console.log(`📡 Broadcasting to device:${deviceUuidValue}:location`);
        io.emit(`device:${deviceUuidValue}:location`, broadcastData);
        
        // Also emit a general location update event
        io.emit('location:update', broadcastData);
        
        console.log('✅ Location broadcast complete');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
      } catch (error) {
        console.error('❌ Error saving location:', error);
        socket.emit('error', { message: 'Failed to save location: ' + error.message });
      }
    });

    // Handle web client subscribing to device updates
    socket.on('subscribe:device', async (data) => {
      console.log('📡 Subscribe request:', data);
      
      try {
        const { deviceUuid } = data;
        
        if (!deviceUuid) {
          socket.emit('error', { message: 'Device UUID required' });
          return;
        }
        
        // Verify user has access to this device
        const device = await deviceModel.findByUuid(deviceUuid);
        
        if (!device) {
          console.log('❌ Device not found:', deviceUuid);
          socket.emit('error', { message: 'Device not found' });
          return;
        }
        
        if (device.user_id !== socket.userId) {
          console.log(`❌ Access denied: User ${socket.userId} -> Device ${deviceUuid}`);
          socket.emit('error', { message: 'Access denied to this device' });
          return;
        }
        
        // Join a room for this device
        socket.join(`device:${deviceUuid}`);
        
        console.log(`✅ User ${socket.userId} subscribed to device ${deviceUuid}`);
        
        // Send last known position
        const lastPosition = await positionModel.getLastPosition(device.id);
        
        if (lastPosition) {
          console.log(`📍 Sending last position for device ${deviceUuid}:`, lastPosition);
          socket.emit(`device:${deviceUuid}:location`, {
            deviceUuid: deviceUuid,
            deviceId: device.id,
            deviceName: device.device_name,
            latitude: lastPosition.latitude,
            longitude: lastPosition.longitude,
            accuracy: lastPosition.accuracy,
            speed: lastPosition.speed,
            heading: lastPosition.heading,
            altitude: lastPosition.altitude,
            timestamp: lastPosition.timestamp
          });
        }
        
        // Send device status
        socket.emit(`device:${deviceUuid}:status`, {
          deviceUuid: deviceUuid,
          status: device.status,
          deviceName: device.device_name
        });
        
        socket.emit('subscribed', { deviceUuid, success: true });
        
      } catch (error) {
        console.error('❌ Error subscribing to device:', error);
        socket.emit('error', { message: 'Subscription failed: ' + error.message });
      }
    });

    // Handle web client unsubscribing
    socket.on('unsubscribe:device', (data) => {
      const { deviceUuid } = data;
      console.log(`📡 Unsubscribe from device: ${deviceUuid}`);
      socket.leave(`device:${deviceUuid}`);
      socket.emit('unsubscribed', { deviceUuid, success: true });
    });

    // Handle device status change (manual)
    socket.on('device:status', async (data) => {
      console.log('📊 Device status update:', data);
      
      try {
        const { deviceUuid, status } = data;
        
        if (!deviceUuid) return;
        
        const device = await deviceModel.findByUuid(deviceUuid);
        if (device && device.user_id === socket.userId) {
          await deviceModel.updateStatus(device.id, status);
          
          io.emit(`device:${deviceUuid}:status`, {
            deviceUuid,
            status,
            deviceName: device.device_name,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error updating device status:', error);
      }
    });

    // Handle heartbeat
    socket.on('heartbeat', (data) => {
      console.log('💓 Heartbeat received:', data);
      socket.emit('heartbeat', { status: 'ok', timestamp: new Date().toISOString() });
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔌 Client disconnected:', socket.id);
      
      if (socket.deviceId) {
        console.log(`📱 Device ${socket.deviceUuid} disconnected`);
        await deviceModel.updateStatus(socket.deviceId, 'offline');
        activeDevices.delete(socket.deviceUuid);
        
        // Notify web clients that device is offline
        io.emit(`device:${socket.deviceUuid}:status`, { 
          deviceUuid: socket.deviceUuid, 
          status: 'offline',
          deviceName: socket.deviceName
        });
      }
      
      if (socket.userId) {
        console.log(`👤 User ${socket.userId} disconnected`);
        activeUsers.delete(socket.userId);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  });

  return { activeDevices, activeUsers };
};