/**
 * Redis Configuration
 * Connects to RedisLabs cloud instance for session storage and caching
 */

const redis = require('redis');

// Prefer explicit host/port/username/password if provided, else use REDIS_URL
const redisOptions = (() => {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;
  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;
  const tls = process.env.REDIS_TLS === 'true';
  if (host && port && username && password) {
    const scheme = tls ? 'rediss' : 'redis';
    const url = `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
    return {
      url,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        connectTimeout: 15000,
      },
    };
  }
  let url = process.env.REDIS_URL || 'redis://localhost:6379';
  if (tls && url.startsWith('redis://')) {
    url = url.replace(/^redis:\/\//, 'rediss://');
  }
  return {
    url,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      connectTimeout: 15000,
    },
  };
})();

// Create Redis client
const redisClient = redis.createClient(redisOptions);

// Error handling
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err.message);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('ready', () => {
  console.log('✅ Redis is ready');
});

// Connect to Redis
redisClient.connect().catch((err) => {
  console.error('Failed to connect to Redis:', err);
});

module.exports = redisClient;
