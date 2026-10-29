# Version 6: fixes for the v5 review (27 October 2026)

Numbers refer to *APAAR_Portal_Problems_v5.pdf*.

## Verified
- **Type check**: passes.
- **Unit tests**: 61 pass (37 original plus 24 new tests for the security rules).
- **Production build**: completes with no warnings.
- **Attack checks**: 49 re-runs of the review's exploits against a live server and PostgreSQL. All are blocked.
- **Browser checks**: 16 UI checks in Chromium pass, covering sign-in, live updates, consent, verification, account switching and registration.
- **Upgrade**: an existing v5 database upgrades in place, with new columns added automatically.

## Critical
| # | Fix |
|---|---|
| 1 | `POST /api/auth/session` removed. Sign-in is now `/api/auth/login` (email and password, scrypt-hashed), `/api/auth/otp/*` (APAAR ID and a random one-time OTP) or `/api/auth/firebase` (the server verifies the Google token). |
| 2 | Roles come from the database only. REGULATOR cannot be self-registered. |
| 3 | User IDs are created by the server. Any `id` the browser sends is ignored. |
| 4 | No hard-coded secret. Production refuses to start without `SESSION_SECRET` and `CREDENTIAL_SIGNING_SECRET`. Development generates random ones in `.secrets.local.json`. |
| 5 | `/ws` and `/api/realtime/stream` require a session token. Each event goes only to users allowed to see it. |
| 6 | Only the student named on a request can grant, reject or revoke consent. |
| 7 | New requests always start as `PENDING_STUDENT_CONSENT`. `VERIFIED` and `TAMPERED_FAILED` are set only by the server's `POST /api/db/requests/:id/verify`. Every status change follows the request lifecycle. |

## High
| # | Fix |
|---|---|
| 8 | Every read is filtered by role and ownership. Password hashes are never returned. |
| 9 | Hard-coded consent removed. Credentials are shown only while consent is active and not expired, and only the requested types. |
| 10 | Institutions can only change students they registered. Employers cannot write student records. |
| 11 | No fixed PIN or OTP anywhere. OTPs are random, expire in 5 minutes, work once and lock after 5 wrong tries. Sign-in is rate-limited. |
| 12 | Signed-in state comes from the server (`/api/auth/me`). Switching accounts requires that account's own sign-in. The Google "fallback" that signed in as any account is removed. |
| 13 | Audit entries are written by the server. Clients can only post `PREFERENCES_UPDATED` and `REPORT_DOWNLOADED`, and the actor is always the signed-in user. |

## Medium
| # | Fix |
|---|---|
| 14 | Institution-issued credentials are signed by the server with HMAC-SHA256 and a secret key. Edited credentials fail verification even if the plain SHA-256 is recomputed. |
| 15 | `server.ts` loads `.env` first. |
| 16 | `DATABASE_URL` or `SQL_*` both work, and `.env.example` documents every setting. |
| 17 | Demo data and forms use `example.com` addresses and `+91 90000 000xx` numbers. |
| 18 | `public/assets/aistudio/` removed (review PDF, WhatsApp images, screenshots). |
| 19 | Google users get their role from the database, and new ones start as students with no APAAR ID linked. |
| 20 | Personal email removed from `security_spec.md`. |

## Low
| # | Fix |
|---|---|
| 21 | `engines.node` set to `>=24.12.0` and documented. |
| 22 | Firebase is already in its own cached chunk. The warning limit is raised to 600 kB with a comment explaining why. |
| 23 | `.aistudio/` is not included in this package (it was already in `.gitignore`). |
| 24 | Package renamed to `apaar-registry-portal` (v6.0.0). Added `npm test`. |

## Prototype labelling
- **Prototype banner on every page**: a banner says this is a hackathon prototype, not an official Government of India / APAAR website.
- **Official-looking branding replaced**: "Ministry of Education, Govt. of India" wording in the header, footer, sample certificate, sample card and alert sender is replaced with prototype labels, so a public copy cannot be mistaken for the real portal.

## Behaviour changes to know about
- **Demo accounts need a password**: set `DEMO_PASSWORD` in `.env`, or use the random one printed in the server console. The demo cards on the login page now only fill in the email.
- **Auto-approval no longer skips consent**: an employer's new request always waits for the student, even if the student's preferences say "auto-approve". Those preferences are stored only in the browser, so the server cannot trust them.
- **Refused actions are undone on screen**: when the server refuses an action (for example an employer clicking "Quick Approve"), a notice explains why and the screen is put back. If the server is offline, actions are shown locally with an "offline" notice.
- **Old v5 user rows have no password**: those users need to register again. The demo accounts are reset to their known details.

## Production Readiness Additions
- **Institution approval**: self-registered `INSTITUTION` accounts start with `institutionApproved: false` and cannot write student records or issue credentials until approved by a `REGULATOR` via `POST /api/db/users/:uid/approve-institution`.
- **SMS gateway**: `POST /api/auth/otp/request` dispatches OTP payloads to `SMS_GATEWAY_URL` (authenticated with `SMS_GATEWAY_API_KEY`) when configured.
- **Session revocation**: `POST /api/auth/logout` revokes the session token on the server so it is immediately rejected by `verifySessionToken`.
