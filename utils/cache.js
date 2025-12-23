const redisClient = require('../config/redis');

const PREFIX = 'cache:';

async function getCache(key) {
  const value = await redisClient.get(PREFIX + key);
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function setCache(key, value, ttlSeconds = 600) {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  if (ttlSeconds && Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
    await redisClient.set(PREFIX + key, stringValue, { EX: ttlSeconds });
  } else {
    await redisClient.set(PREFIX + key, stringValue);
  }
}

async function delCache(key) {
  await redisClient.del(PREFIX + key);
}

module.exports = {
  getCache,
  setCache,
  delCache,
};
