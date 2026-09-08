# Firestore security rules (Admin whitelist)

This repository now includes Firestore rules that only allow users with the custom claim `admin: true` to mutate items and transactions.

Files added:
- `firestore.rules` — Firestore security rules using `request.auth.token.admin` as the whitelist.
- `scripts/setAdmin.js` — small helper to set the admin custom claim using the Firebase Admin SDK.

How to deploy the rules (Firebase CLI)

1. Install the Firebase CLI if you don't have it:
   npm install -g firebase-tools

2. Authenticate and select your project (inventory-app-kk07):
   firebase login
   firebase use --add

3. Place `firestore.rules` in your project folder (it's already in the repo root). Then run:
   firebase deploy --only firestore:rules --project inventory-app-kk07

How to set an admin user (one-off)

1. In Firebase Console → Authentication → Users find the user's UID.
2. Download a service account JSON: Firebase Console → Project settings → Service accounts → Generate new private key (keep it secret).
3. Run locally (do NOT commit the JSON):
   node scripts/setAdmin.js /path/to/service-account.json USER_UID

After setting the claim the user must sign out and sign in again to receive the updated ID token.

Notes and recommendations
- Do NOT commit service account credentials to the repository.
- You can restrict `allow read` in `firestore.rules` to `request.auth != null` if you want to require sign-in for reads as well.
- For maximum security, consider moving balance-changing logic into a Cloud Function and deny client writes entirely.
