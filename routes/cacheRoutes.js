const express = require('express');
const router = express.Router();
const { getCache, setCache, delCache } = require('../utils/cache');

router.get('/demo', async (req, res) => {
  try {
    await setCache('foo', 'bar', 600);
    const result = await getCache('foo');
    res.json({ key: 'cache:foo', value: result, ttlSeconds: 600 });
  } catch (err) {
    res.status(500).json({ error: 'Cache demo failed', details: err.message });
  }
});

router.get('/get/:key', async (req, res) => {
  try {
    const value = await getCache(req.params.key);
    res.json({ key: `cache:${req.params.key}`, value });
  } catch (err) {
    res.status(500).json({ error: 'Cache get failed', details: err.message });
  }
});

router.post('/set', async (req, res) => {
  try {
    const { key, value, ttlSeconds } = req.body;
    await setCache(key, value, ttlSeconds);
    res.json({ status: 'ok', key: `cache:${key}`, ttlSeconds: ttlSeconds || null });
  } catch (err) {
    res.status(500).json({ error: 'Cache set failed', details: err.message });
  }
});

router.delete('/del/:key', async (req, res) => {
  try {
    await delCache(req.params.key);
    res.json({ status: 'ok', key: `cache:${req.params.key}` });
  } catch (err) {
    res.status(500).json({ error: 'Cache delete failed', details: err.message });
  }
});

module.exports = router;
