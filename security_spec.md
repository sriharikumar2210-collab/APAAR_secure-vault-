# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default Deny**: All paths not explicitly matched (`/databases/{database}/documents/{document=**}`) deny all reads and writes.
2. **Identity & Ownership Isolation (PII Protection)**:
   - `/users/{userId}` contains PII (`email`, `name`, `organization`). Only the document owner (`request.auth.uid == userId`) or a verified Admin (a user whose UID has a document in `/admins/{uid}` and whose email is verified) can `get`, `create`, or `update` the document.
   - `uid` in `/users/{userId}` must strictly equal `request.auth.uid` and `userId`, and is immutable on update.
3. **Privilege Escalation Prevention**:
   - Users creating `/users/{userId}` can only self-assign non-privileged roles (`STUDENT`, `EMPLOYER`, `INSTITUTION`). Only a verified Admin can assign `REGULATOR` or modify `role` on update.
4. **Temporal & Volumetric Integrity**:
   - All string fields enforce strict `.size()` bounds matching `firebase-blueprint.json`.
   - `createdAt` and `updatedAt` must equal `request.time` (server timestamp). `createdAt` is immutable on update.
5. **Query Enforcer on `/sessionLogs/{logId}` & `/vaultCredentials/{credentialId}`**:
   - `list` and `get` require `resource.data.ownerId == request.auth.uid || isAdmin()`.
   - `/vaultCredentials/{credentialId}` records are immutable once sealed (`allow update: if false; allow delete: if isAdmin() && isValidId(credentialId);`).

## 2. The "Dirty Dozen" Payloads (Rejected with `PERMISSION_DENIED`)
1. **Unauthenticated Write**: `auth = null` writing to `/users/user_1` or `/vaultCredentials/cred_1`.
2. **Unverified Email Write**: `auth.token.email_verified = false` writing to `/users/user_1` or `/vaultCredentials/cred_1`.
3. **Identity Spoofing**: `auth.uid = "attacker"` creating `/vaultCredentials/cred_1` with `ownerId: "victim"`.
4. **Shadow Field Injection**: Creating `/vaultCredentials/cred_1` with extra key `"isVerifiedOverride": true`.
5. **Self-Assigned Regulator Role**: Non-admin creating `/users/user_1` with `role: "REGULATOR"`.
6. **Role Escalation on Update**: Non-admin updating `role` from `"STUDENT"` to `"REGULATOR"`.
7. **PII Cross-User Read**: `auth.uid = "user_2"` reading `/users/user_1` or `/vaultCredentials/cred_1` owned by `user_1`.
8. **Forged Client Timestamp**: Creating `/vaultCredentials/cred_1` with `createdAt` set to a past timestamp instead of `request.time`.
9. **Immutable Vault Record Mutation**: Attempting to `update` a sealed `/vaultCredentials/cred_1` document.
10. **Oversized String ("Denial of Wallet")**: Creating `/vaultCredentials/cred_1` with `title` > 200 chars or `vaultUri` > 300 chars.
11. **ID Poisoning**: Creating `/vaultCredentials/invalid id with spaces!` failing `isValidId()`.
12. **Blanket List Scraping**: Listing `/vaultCredentials` without `where('ownerId', '==', request.auth.uid)`.
