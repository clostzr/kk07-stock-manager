// scripts/setAdmin.js
// Usage: node setAdmin.js <serviceAccount.json> <userUid>
// This script sets the custom claim { admin: true } on the specified user UID.
// Do NOT commit your service account JSON to the repository.

const admin = require('firebase-admin');
const fs = require('fs');

if (process.argv.length < 4) {
  console.error('Usage: node setAdmin.js <serviceAccount.json> <userUid>');
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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setAdmin(uid) {
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log('Custom claim "admin" set for', uid);
    console.log('Make sure the user signs out and signs in again to refresh their ID token.');
  } catch (err) {
    console.error('Error setting admin claim:', err);
  } finally {
    process.exit(0);
  }
}

setAdmin(uid);
