// scripts/setAdmin.js
// Usage: node scripts/setAdmin.js <serviceAccount.json> <userUid>

const fs = require('fs');
const path = require('path');

if (process.argv.length < 4) {
  console.error('Usage: node scripts/setAdmin.js <serviceAccount.json> <userUid>');
  process.exit(1);
}

const serviceAccountPath = process.argv[2];
const uid = process.argv[3];

let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
} catch (err) {
  console.error('Failed to read service account JSON:', err.message);
  process.exit(1);
}

(async () => {
  // dynamic import to handle both CJS and ESM package shapes
  let adminModule;
  try {
    adminModule = await import('firebase-admin');
  } catch (e) {
    try {
      adminModule = require('firebase-admin');
    } catch (e2) {
      console.error('Failed to load firebase-admin module:', e, e2);
      process.exit(1);
    }
  }

  const admin = adminModule.default || adminModule;

  // Accept either admin.credential.cert(...) or admin.cert(...)
  const hasCredentialCert = admin && admin.credential && typeof admin.credential.cert === 'function';
  const hasTopLevelCert = admin && typeof admin.cert === 'function';

  if (!hasCredentialCert && !hasTopLevelCert) {
    console.error('firebase-admin did not expose credential.cert or cert as expected. Available keys:', Object.keys(admin || {}));
    process.exit(1);
  }

  try {
    const credentialFactory = hasCredentialCert ? admin.credential.cert : admin.cert;
    admin.initializeApp({
      credential: credentialFactory(serviceAccount)
    });

    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log('Custom claim "admin" set for', uid);
    console.log('Make sure the user signs out and signs in again to refresh their ID token.');
    process.exit(0);
  } catch (err) {
    console.error('Error setting admin claim:', err);
    process.exit(1);
  }
})();
