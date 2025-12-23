#!/usr/bin/env node

/**
 * SSL Certificate Checker for Medisync
 * Displays certificate information and status
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CERTS_DIR = path.join(__dirname, '../config/certs');
const KEY_FILE = path.join(CERTS_DIR, 'server.key');
const CERT_FILE = path.join(CERTS_DIR, 'server.crt');

console.log('🔍 Checking SSL Certificate Status...\n');
console.log('=' .repeat(60));

// Check if files exist
const keyExists = fs.existsSync(KEY_FILE);
const certExists = fs.existsSync(CERT_FILE);

console.log('\n📂 Certificate Files:');
console.log(`   Private Key (${KEY_FILE}): ${keyExists ? '✅ Found' : '❌ Missing'}`);
console.log(`   Certificate (${CERT_FILE}): ${certExists ? '✅ Found' : '❌ Missing'}`);

if (!keyExists || !certExists) {
  console.log('\n⚠️  Certificates are incomplete!');
  console.log('To generate certificates, run:');
  console.log('   npm run ssl:generate');
  console.log('   or');
  console.log('   node scripts/generateSSL.js\n');
  process.exit(1);
}

// Get file info
const keyStats = fs.statSync(KEY_FILE);
const certStats = fs.statSync(CERT_FILE);

console.log('\n📊 File Information:');
console.log(`   Key Size: ${keyStats.size} bytes`);
console.log(`   Cert Size: ${certStats.size} bytes`);
console.log(`   Key Created: ${keyStats.birthtime.toLocaleString()}`);
console.log(`   Cert Created: ${certStats.birthtime.toLocaleString()}`);

// Check if openssl is available
let opensslAvailable = false;
try {
  execSync('openssl version', { stdio: 'ignore' });
  opensslAvailable = true;
} catch (e) {
  // OpenSSL not available
}

if (opensslAvailable) {
  console.log('\n🔐 Certificate Details:');
  
  try {
    // Get certificate info
    const output = execSync(
      `openssl x509 -text -noout -in "${CERT_FILE}"`,
      { encoding: 'utf8' }
    );

    // Parse certificate details
    const lines = output.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Issuer:') || 
          trimmed.startsWith('Subject:') ||
          trimmed.startsWith('Not Before:') ||
          trimmed.startsWith('Not After:') ||
          trimmed.startsWith('Public-Key:') ||
          trimmed.startsWith('Signature Algorithm:')) {
        console.log('   ' + trimmed);
      }
    }

    // Check expiration
    console.log('\n📅 Expiration Check:');
    const endDateOutput = execSync(
      `openssl x509 -enddate -noout -in "${CERT_FILE}"`,
      { encoding: 'utf8' }
    ).trim();
    
    console.log('   ' + endDateOutput);
    
    // Check if expired
    const endDateMatch = endDateOutput.match(/=(.+)/);
    if (endDateMatch) {
      const expirationDate = new Date(endDateMatch[1]);
      const now = new Date();
      const daysLeft = Math.floor((expirationDate - now) / (1000 * 60 * 60 * 24));
      
      if (daysLeft < 0) {
        console.log(`   Status: ❌ EXPIRED (${Math.abs(daysLeft)} days ago)`);
      } else if (daysLeft < 30) {
        console.log(`   Status: ⚠️  EXPIRING SOON (${daysLeft} days left)`);
      } else {
        console.log(`   Status: ✅ VALID (${daysLeft} days left)`);
      }
    }

  } catch (err) {
    console.log('   ⚠️  Could not read certificate details');
  }

} else {
  console.log('\n⚠️  OpenSSL not found - Cannot display detailed certificate info');
  console.log('   Install OpenSSL to see certificate details:');
  console.log('   Windows: https://slproweb.com/products/Win32OpenSSL.html');
  console.log('   macOS: brew install openssl');
  console.log('   Linux: sudo apt-get install openssl');
}

console.log('\n' + '='.repeat(60));
console.log('✅ Certificate check complete!\n');

console.log('📖 For more information, see: SSL_HTTPS_GUIDE.md\n');
