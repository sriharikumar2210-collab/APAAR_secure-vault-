# APAAR Student Registry & Employer Verification Portal (v6)

A full-stack **Automated Permanent Academic Account Registry (APAAR)** and **Employer Background Verification (BGV)** prototype aligned with **NEP 2020**, **AICTE**, **DigiLocker NAD** and the **DPDP Act 2023**.

## Key features
1. **Student onboarding** by portal form or authenticated REST API (`POST /api/db/students`).
2. **AICTE approved intake and supernumerary seat matrix** (TFW / PMSSS / EWS, NRI, OCI, Foreign National).
3. **Five automated validation checks**: duplicate APAAR ID in one institution, invalid or missing ID, excess admission, inconsistent data, and cross-institution duplicate.
4. **Live dashboards** over WebSocket (`/ws`) and Server-Sent Events (`/api/realtime/stream`), filtered per user.
5. **Signed credentials**: institutions issue credentials and the server signs them with a secret key (HMAC-SHA256). Any later edit is detected.
6. **Student consent enforced on the server**: employers see credentials only while the student's consent is active, and only the credential types they asked for.
7. **APAAR ID on degree certificates**, next to the Student ID / PEN.

## Setup
Requires **Node.js 24.12 or newer** (the Firebase SDK needs it) and **PostgreSQL**.

1. Copy `.env.example` to `.env` and set `DATABASE_URL` (or the `SQL_*` values).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server (it creates the tables and loads demo data on first run):
   ```bash
   npm run dev
   ```
   Open http://localhost:3000. In development, the server console prints the **demo account password** unless you set `DEMO_PASSWORD` in `.env`.
4. Run the tests:
   ```bash
   npm test
   ```

Optional: `npm run db:push` applies the Drizzle schema with the admin user.

### Production
Set `NODE_ENV=production`, `SESSION_SECRET` and `CREDENTIAL_SIGNING_SECRET` (each at least 32 random characters). The server **refuses to start** without them. Run `npm run build`, then `npm start`. Demo accounts stay locked unless `DEMO_PASSWORD` is set.

## Demo accounts
| Role | Email |
|---|---|
| Employer | `v.sharma@tcs.example.com` |
| Student | `abinaya.attur@student.example.edu.in` (or APAAR ID `2990 9583 2586` + OTP) |
| Institution | `registrar@annauniv.example.edu` |
| Regulator | `compliance@aicte.example.gov.in` |

All use the demo password. In development, the APAAR + OTP sign-in shows the OTP on screen, because no SMS gateway is connected.

## Security model
- **Sign-in is checked on the server.** Passwords are hashed with scrypt, OTPs are random, expire in 5 minutes and work once, and attempts are rate-limited.
- **Session tokens hold only the user ID.** Role, organization and APAAR ID are read from the database on every request, so they cannot be claimed by the browser.
- **Regulator accounts cannot be self-registered.**
- **Every read is filtered:**
  - students see only their own record;
  - employers see only students they have a request for, with contact details hidden;
  - institutions see the students they registered;
  - the regulator sees everything.
- **Every write is checked:**
  - only the student named on a request can grant, reject or revoke consent;
  - only the server's verification step can mark a request `VERIFIED` or `TAMPERED_FAILED`;
  - institutions can only change students they registered.
- **The audit trail is written by the server.** The actor, time, ID and fingerprint are never taken from the request.
- **Live updates require a session token** and are delivered only to users allowed to see them.

### Production controls
- **Regulator approval for new institutions**: self-registered `INSTITUTION` accounts start pending approval (`institutionApproved: false`) and cannot register students or issue credentials until approved by the Regulator.
- **Configurable SMS gateway**: set `SMS_GATEWAY_URL` and `SMS_GATEWAY_API_KEY` in `.env` to dispatch OTPs to an external SMS webhook.
- **Server-side session revocation**: signing out calls `POST /api/auth/logout`, immediately revoking the session token on the server.
