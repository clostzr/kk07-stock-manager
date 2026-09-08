// scripts/setAdmin.js
// Usage: node scripts/setAdmin.js <serviceAccount.json> <userUid>

const fs = require('fs');

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
  let adminModule;
  try {
    // Try dynamic import first (works for ESM builds)
    adminModule = await import('firebase-admin');
  } catch (e) {
    // Fallback to require for CommonJS
    try {
      adminModule = require('firebase-admin');
    } catch (e2) {
      console.error('Failed to load firebase-admin module:', e, e2);
      process.exit(1);
    }
  }

  const admin = adminModule.default || adminModule;

  // Determine credential factory: admin.credential.cert OR top-level admin.cert
  const hasCredentialCert = admin && admin.credential && typeof admin.credential.cert === 'function';
  const hasTopLevelCert = admin && typeof admin.cert === 'function';

  if (!hasCredentialCert && !hasTopLevelCert) {
    console.error('firebase-admin did not expose credential.cert or cert. Available keys:', Object.keys(admin || {}));
    process.exit(1);
  }

  try {
    const credentialFactory = hasCredentialCert ? admin.credential.cert : admin.cert;

    // Initialize app if not already initialized
    try {
      // Some admin packages require passing credential via initializeApp; this will
      // throw if called twice — catch and continue if app already exists.
      admin.initializeApp({
        credential: credentialFactory(serviceAccount)
      });
    } catch (initErr) {
      // If initializeApp throws because an app exists, try to continue.
      // Otherwise, rethrow.
      const msg = String(initErr || '');
      if (!/already exists/i.test(msg)) {
        console.error('Failed to initialize firebase-admin app:', initErr);
        process.exit(1);
      }
      // else continue — app likely already initialized with proper creds
    }

    // Obtain auth instance via supported accessor
    let authInstance = null;
    if (typeof admin.auth === 'function') {
      authInstance = admin.auth();
    } else if (typeof admin.getAuth === 'function') {
      // modular-style API
      authInstance = admin.getAuth();
    } else if (typeof admin.auth === 'object' && admin.auth !== null) {
      authInstance = admin.auth;
    } else {
      console.error('No supported auth accessor found on firebase-admin. Available keys:', Object.keys(admin || {}));
      process.exit(1);
    }

    if (!authInstance || typeof authInstance.setCustomUserClaims !== 'function') {
      console.error('Auth instance does not provide setCustomUserClaims. Auth keys:', Object.keys(authInstance || {}));
      process.exit(1);
    }

    await authInstance.setCustomUserClaims(uid, { admin: true });
    console.log('Custom claim "admin" set for', uid);
    console.log('Make sure the user signs out and signs in again to refresh their ID token.');
    process.exit(0);
  } catch (err) {
    console.error('Error setting admin claim:', err);
    process.exit(1);
  }
})();
