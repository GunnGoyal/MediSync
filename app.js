require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const session = require('express-session');
const pg = require('pg');
const PgSession = require('connect-pg-simple')(session);
// Support multiple connect-redis versions
let RedisStoreCtor = null;
try {
  const cr = require('connect-redis');
  RedisStoreCtor = cr.RedisStore || cr.default || null;
} catch (e) {
  RedisStoreCtor = null;
}
const redisClientShared = require('./config/redis');
const pool = require('./config/db');
const { body } = require('express-validator');

// Initialize Redis client if URL provided
let sessionStore = null;

if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  try {
    if (RedisStoreCtor) {
      sessionStore = new RedisStoreCtor({ client: redisClientShared });
    } else {
      // Legacy connect-redis v5/v6 API
      const LegacyRedisStore = require('connect-redis')(session);
      sessionStore = new LegacyRedisStore({ client: redisClientShared });
    }
  } catch (err) {
    console.warn('⚠️  Redis setup failed, using PostgreSQL:', err.message);
  }
}

// Fallback to PostgreSQL if Redis not available
if (!sessionStore) {
  sessionStore = new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  });
  if (!process.env.REDIS_URL) {
    console.log('ℹ️  Using PostgreSQL session store (REDIS_URL not configured)');
  }
}

const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const healthIntelligenceRoutes = require('./routes/healthIntelligenceRoutes');
const advancedFeaturesRoutes = require('./routes/advancedFeaturesRoutes');
const cacheRoutes = require('./routes/cacheRoutes');

// Initialize advanced feature models
const chatModel = require('./models/chatModel');
const ehrModel = require('./models/ehrModel');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'devsecret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.role = req.session.role || null;
  next();
});

app.get('/', (req, res) => {
  res.render('shared/home');
});

app.use('/auth', authRoutes);
app.use('/patient', patientRoutes);
app.use('/doctor', doctorRoutes);
app.use('/predict', predictionRoutes);
app.use('/admin', adminRoutes);
app.use('/health-intelligence', healthIntelligenceRoutes);
app.use('/advanced', advancedFeaturesRoutes);
app.use('/cache', cacheRoutes);

// Initialize advanced feature tables on startup
async function initializeAdvancedFeatures() {
  try {
    await chatModel.initializeChatTables();
    console.log('✅ Chat tables initialized');
    
    await ehrModel.initializeEHRTables();
    console.log('✅ EHR tables initialized');
  } catch (err) {
    console.error('Advanced features initialization error:', err);
  }
}

initializeAdvancedFeatures();

// Initialize DB tables on startup (idempotent)
try {
  const initSql = fs.readFileSync(path.join(__dirname, 'config', 'db_init.sql'), 'utf8');
  pool.query(initSql).catch(err => console.error('DB init error:', err));
} catch (e) {
  console.warn('db_init.sql not found or unreadable');
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

// SSL/HTTPS Configuration - Support both HTTP and HTTPS
const port = process.env.PORT || 3000;
const sslPort = process.env.SSL_PORT || 3443;

// Path to SSL certificates
const keyPath = path.join(__dirname, 'config/certs/server.key');
const certPath = path.join(__dirname, 'config/certs/server.crt');

// Check if SSL certificates exist
const sslCertsExist = fs.existsSync(keyPath) && fs.existsSync(certPath);

// Start HTTP server (always running)
const httpServer = http.createServer(app);
httpServer.listen(port, () => {
  console.log(`🌐 Medisync HTTP running on port ${port}`);
  console.log(`   📍 Access: http://localhost:${port}`);
});

// Start HTTPS server (if certificates available)
if (sslCertsExist) {
  try {
    const privateKey = fs.readFileSync(keyPath, 'utf8');
    const certificate = fs.readFileSync(certPath, 'utf8');
    const credentials = { key: privateKey, cert: certificate };

    // Create HTTPS server
    const httpsServer = https.createServer(credentials, app);
    httpsServer.listen(sslPort, () => {
      console.log(`🔒 Medisync HTTPS running on port ${sslPort}`);
      console.log(`   📍 Access: https://localhost:${sslPort}`);
      console.log(`\n✅ Both HTTP and HTTPS servers are running!\n`);
    });
  } catch (err) {
    console.error('❌ Error loading SSL certificates:', err.message);
    console.log(`⚠️  HTTPS server failed to start. HTTP server is available on port ${port}`);
  }
} else {
  console.warn('⚠️  SSL certificates not found.');
  console.log(`📄 To generate SSL certificates, run:`);
  console.log(`   npm run ssl:generate\n`);
}