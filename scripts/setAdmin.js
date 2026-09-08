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

  // credential factory detection
  const hasCredentialCert = admin && admin.credential && typeof admin.credential.cert === 'function';
  const hasTopLevelCert = admin && typeof admin.cert === 'function';

  if (!hasCredentialCert && !hasTopLevelCert) {
    console.error('firebase-admin did not expose credential.cert or cert. Available keys:', Object.keys(admin || {}));
    process.exit(1);
  }

  const credentialFactory = hasCredentialCert ? admin.credential.cert : admin.cert;

  // Initialize app (tolerate "already exists")
  try {
    admin.initializeApp({
      credential: credentialFactory(serviceAccount)
    });
  } catch (initErr) {
    const msg = String(initErr || '');
    if (!/already exists/i.test(msg)) {
      console.error('Failed to initialize firebase-admin app:', initErr);
      process.exit(1);
    }
    // else continue
  }

  // helper to collect diagnostics
  const adminKeys = Object.keys(admin || {});
  console.log('firebase-admin available keys:', adminKeys);

  // Try multiple ways to obtain an auth instance
  let authInstance = null;
  try {
    if (typeof admin.auth === 'function') {
      console.log('Using admin.auth()');
      authInstance = admin.auth();
    } else if (typeof admin.getAuth === 'function') {
      console.log('Using admin.getAuth()');
      authInstance = admin.getAuth();
    } else {
      // Try importing the auth submodule (some builds require this)
      try {
        const authModuleImport = await import('firebase-admin/auth');
        const authModule = authModuleImport.default || authModuleImport;
        console.log('Imported firebase-admin/auth keys:', Object.keys(authModule || {}));
        // prefer getAuth(app) signature
        const apps = (typeof admin.getApps === 'function') ? admin.getApps() : [];
        const app = apps.length ? apps[0] : undefined;
        if (typeof authModule.getAuth === 'function') {
          console.log('Using getAuth from firebase-admin/auth', app ? 'with app' : 'without app');
          authInstance = app ? authModule.getAuth(app) : authModule.getAuth();
        } else if (typeof authModule.getAuth === 'object') {
          authInstance = authModule.getAuth;
        }
      } catch (e) {
        console.log('Could not import firebase-admin/auth:', e && e.message);
      }

      // fallback to auth object
      if (!authInstance && admin && typeof admin.auth === 'object' && admin.auth !== null) {
        console.log('Using admin.auth (object)');
        authInstance = admin.auth;
      }
    }
  } catch (err) {
    console.error('Error while detecting auth accessor:', err);
    process.exit(1);
  }

  if (!authInstance) {
    console.error('No supported auth accessor found on firebase-admin. Final available keys:', Object.keys(admin || {}));
    process.exit(1);
  }

  if (typeof authInstance.setCustomUserClaims !== 'function') {
    console.error('Auth instance does not provide setCustomUserClaims. Auth keys:', Object.keys(authInstance || {}));
    process.exit(1);
  }

  try {
    await authInstance.setCustomUserClaims(uid, { admin: true });
    console.log('Custom claim "admin" set for', uid);
    console.log('Make sure the user signs out and signs in again to refresh their ID token.');
    process.exit(0);
  } catch (err) {
    console.error('Error setting admin claim:', err);
    process.exit(1);
  }
})();
