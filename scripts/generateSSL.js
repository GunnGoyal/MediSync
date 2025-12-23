#!/usr/bin/env node

/**
 * SSL Certificate Generator for Medisync
 * Generates self-signed certificates using pem package
 */

const fs = require('fs');
const path = require('path');
const pem = require('pem');

const CERTS_DIR = path.join(__dirname, '../config/certs');
const KEY_FILE = path.join(CERTS_DIR, 'server.key');
const CERT_FILE = path.join(CERTS_DIR, 'server.crt');

// Create certs directory if it doesn't exist
if (!fs.existsSync(CERTS_DIR)) {
  fs.mkdirSync(CERTS_DIR, { recursive: true });
  console.log(`✅ Created ${CERTS_DIR}`);
}

// Check if certificates already exist
if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
  console.log('✅ SSL certificates already exist:');
  console.log(`   - Key: ${KEY_FILE}`);
  console.log(`   - Certificate: ${CERT_FILE}`);
  console.log('\n✨ Your app is ready to use HTTPS!\n');
  process.exit(0);
}

console.log('🔐 Generating self-signed SSL certificates...\n');

// Create a self-signed certificate
pem.createCertificate({
  days: 365,
  selfSigned: true,
  keySize: 2048,
  commonName: 'localhost',
  country: 'US',
  state: 'State',
  locality: 'City',
  organization: 'Medisync'
}, (err, keys) => {
  if (err) {
    console.error('❌ Error generating certificates:');
    console.error(err.message);
    
    if (err.message.includes('openssl')) {
      console.error('\n📦 Please install openssl:');
      console.error('   Windows: https://slproweb.com/products/Win32OpenSSL.html');
      console.error('   macOS: brew install openssl');
      console.error('   Linux: sudo apt-get install openssl');
    }
    process.exit(1);
  }

  try {
    // Write private key
    fs.writeFileSync(KEY_FILE, keys.serviceKey);
    fs.chmodSync(KEY_FILE, 0o600);

    // Write certificate
    fs.writeFileSync(CERT_FILE, keys.certificate);
    fs.chmodSync(CERT_FILE, 0o644);

    console.log('✅ SSL certificates generated successfully!\n');
    console.log('📄 Certificate Details:');
    console.log(`   - Key file: ${KEY_FILE}`);
    console.log(`   - Certificate file: ${CERT_FILE}`);
    console.log(`   - Valid for: 365 days`);
    console.log(`   - Algorithm: RSA 2048-bit`);
    console.log(`   - Common Name (CN): localhost\n`);
    console.log('⚠️  WARNING: This is a self-signed certificate for development only!');
    console.log('   For production, use a certificate from a trusted CA.\n');
    console.log('✨ Your app.js has been updated to use HTTPS.');
    console.log('🚀 Start your server with: node app.js\n');
  } catch (writeErr) {
    console.error('❌ Error writing certificate files:');
    console.error(writeErr.message);
    process.exit(1);
  }
});
