#!/usr/bin/env node
/**
 * LeadMiner License Generator
 * 
 * Generates signed license keys that can be validated by the native Rust module.
 * 
 * Usage:
 *   node tools/generate-license.js --hardware-id <id> [--tier pro] [--expires-days 365]
 * 
 * The private key must be at native/keys/private_key.pem (NEVER commit this file).
 * 
 * Examples:
 *   node tools/generate-license.js --hardware-id abc123def456
 *   node tools/generate-license.js --hardware-id abc123def456 --tier enterprise --expires-days 365
 *   node tools/generate-license.js --hardware-id abc123def456 --tier basic --lifetime
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    hardwareId: null,
    tier: 'pro',
    expiresDays: null,
    lifetime: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--hardware-id':
      case '-h':
        parsed.hardwareId = args[++i];
        break;
      case '--tier':
      case '-t':
        parsed.tier = args[++i];
        break;
      case '--expires-days':
      case '-e':
        parsed.expiresDays = parseInt(args[++i], 10);
        break;
      case '--lifetime':
      case '-l':
        parsed.lifetime = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
    }
  }

  return parsed;
}

function printUsage() {
  console.log(`
LeadMiner License Generator

Usage:
  node tools/generate-license.js --hardware-id <id> [options]

Options:
  --hardware-id, -h  <id>     Device hardware ID (required)
  --tier, -t         <tier>   License tier: basic, pro, enterprise (default: pro)
  --expires-days, -e <days>   Days until expiration (default: no expiration)
  --lifetime, -l              Explicitly mark as lifetime license
  --help                      Show this help message

Examples:
  node tools/generate-license.js --hardware-id abc123 --tier pro --lifetime
  node tools/generate-license.js --hardware-id abc123 --tier basic --expires-days 365
`);
}

function generateLicense(hardwareId, tier, expiresDays, isLifetime) {
  // Load private key
  const privateKeyPath = path.join(__dirname, '..', 'native', 'keys', 'private_key.pem');
  if (!fs.existsSync(privateKeyPath)) {
    console.error('ERROR: Private key not found at:', privateKeyPath);
    console.error('Generate a keypair first: see native/keys/');
    process.exit(1);
  }

  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');

  // Validate tier
  const validTiers = ['basic', 'pro', 'enterprise'];
  if (!validTiers.includes(tier)) {
    console.error(`ERROR: Invalid tier "${tier}". Must be one of: ${validTiers.join(', ')}`);
    process.exit(1);
  }

  // Build license object — must match Rust License struct exactly
  // CRITICAL: chrono's to_rfc3339() outputs "+00:00" (not "Z") and omits
  // fractional seconds when they are zero. The signing message uses to_rfc3339(),
  // so we must produce the exact same format.
  const now = new Date();
  now.setMilliseconds(0); // Truncate ms so chrono won't add fractional seconds

  // Format as chrono DateTime<Utc>::to_rfc3339() would — "+00:00" not "Z"
  const issuedAt = now.toISOString().replace('.000Z', '+00:00');

  let expiresAt = null;
  if (expiresDays && !isLifetime) {
    const expiry = new Date(now.getTime() + expiresDays * 24 * 60 * 60 * 1000);
    expiry.setMilliseconds(0);
    expiresAt = expiry.toISOString().replace('.000Z', '+00:00');
  }

  // Generate a unique key identifier
  const keyId = `LM-${crypto.randomBytes(8).toString('hex')}`;

  // Build the signing message — MUST match Rust's verify_signature format exactly:
  // format!("{}:{}:{}:{}", license.key, serde_json::to_string(&license.tier), license.issued_at.to_rfc3339(), license.hardware_id)
  // serde_json::to_string on an enum with serde(rename_all = "snake_case") produces: "\"pro\""
  const tierJson = JSON.stringify(tier); // produces "pro" with quotes — matches serde_json::to_string
  const message = `${keyId}:${tierJson}:${issuedAt}:${hardwareId}`;

  // SHA256 hash the message
  const hash = crypto.createHash('sha256').update(message).digest();

  // Sign with RSA PKCS1v15 — use RSA_NO_PADDING equivalent with manual PKCS1v15
  // The Rust side uses Pkcs1v15Sign::new_unprefixed() which means raw hash, no DigestInfo ASN.1 prefix
  // In Node.js, we need to use the raw RSA private key operation with PKCS1v1.5 padding on the raw hash
  const privateKey = crypto.createPrivateKey(privateKeyPem);

  // Node.js sign with RSA_PKCS1_PADDING on raw data (no hash OID prefix) 
  // We need to use crypto.privateEncrypt with RSA_PKCS1_PADDING to match Rust's new_unprefixed()
  const signature = crypto.privateEncrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    hash
  );

  // Build the license data object matching Rust's License struct
  const licenseData = {
    key: keyId,
    tier: tier,
    issued_at: issuedAt,
    expires_at: expiresAt,
    hardware_id: hardwareId,
    signature: Array.from(signature), // Vec<u8> in Rust deserializes from JSON array of numbers
  };

  // Encode as base64 and prefix with LM-
  const licenseJson = JSON.stringify(licenseData);
  const licenseBase64 = Buffer.from(licenseJson).toString('base64');
  const fullLicenseKey = `LM-${licenseBase64}`;

  return {
    key: fullLicenseKey,
    details: {
      id: keyId,
      tier,
      issuedAt,
      expiresAt,
      hardwareId,
      isLifetime: isLifetime || !expiresAt,
    },
  };
}

// Main
const args = parseArgs();

if (!args.hardwareId) {
  console.error('ERROR: --hardware-id is required');
  console.error('Run with --help for usage information');
  process.exit(1);
}

const result = generateLicense(args.hardwareId, args.tier, args.expiresDays, args.lifetime);

console.log('\n╔══════════════════════════════════════════╗');
console.log('║     LeadMiner License Generated          ║');
console.log('╠══════════════════════════════════════════╣');
console.log(`║ Tier:       ${result.details.tier.padEnd(28)}║`);
console.log(`║ Hardware:   ${result.details.hardwareId.substring(0, 28).padEnd(28)}║`);
console.log(`║ Issued:     ${result.details.issuedAt.substring(0, 28).padEnd(28)}║`);
if (result.details.expiresAt) {
  console.log(`║ Expires:    ${result.details.expiresAt.substring(0, 28).padEnd(28)}║`);
} else {
  console.log(`║ Expires:    ${'Never (Lifetime)'.padEnd(28)}║`);
}
console.log('╠══════════════════════════════════════════╣');
console.log('║ LICENSE KEY:                             ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');
console.log(result.key);
console.log('');
console.log(`(${result.key.length} characters)`);
console.log('');
