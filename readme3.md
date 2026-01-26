# CronoX_v2 Deep Diagnosis Report

## Project Intent Summary
CronoX_v2 is structured as a two‑sided marketplace for professional time, where professionals mint time tokens, list them for purchase, and buyers purchase, book, and complete sessions that trigger payments. The backend also contains supporting services for pricing (dynamic pricing based on metrics), metrics ingestion, and auditing of lifecycle events, indicating an intent to evolve into a full lifecycle marketplace with telemetry and auditability.

Evidence anchors: domain models and lifecycle enums show the token → booking → session → payment flow, and marketplace/scheduling/payment routes enforce role‑based access across that lifecycle.

## Architecture Flow Diagram
```
Buyer/Professional
  │
  ├─ Auth (register/login) ──> JWT role claims
  │
  ├─ Professional flow:
  │     Mint Token (drafted) -> List Token (listed)
  │
  └─ Buyer flow:
        Browse listed tokens -> Purchase token -> Book session
                                   │
                                   └─ Session start/end -> Payment record -> Audit log

Supporting services:
  Metrics ingestion -> Pricing calculation -> Audit log
```

## Feature Maturity Table
| Feature / Flow | Backend Status | Frontend Status | Notes |
| --- | --- | --- | --- |
| Auth register/login | Implemented | Implemented | JWT role is returned and stored. |
| Professional onboarding | Implemented (auto‑creates Professional) | UI exists | No UI for editing professional profile. |
| Token mint/list | Implemented | Implemented | Create Session page mints then lists. |
| Marketplace browse/details | Implemented | Implemented | Uses `/marketplace/tokens` and details page. |
| Token purchase | Implemented | Missing | UI does not call purchase endpoint. |
| Booking creation | Implemented | Missing | No UI to book a purchased token. |
| Session start/end | Implemented | Missing | No UI to start/end sessions. |
| Payment capture & payout | Partial | Placeholder | Payment records created via repo, UI is static. |
| Metrics ingestion | Partial | Missing | API exists, no UI or device ingestion. |
| Pricing calculation | Partial | Missing | Uses placeholder random modifiers. |
| Auditing | Partial | Missing | Audit logs created in some flows only. |

## Backend Consistency & Data Model Notes
- Schema enums and repository logic are aligned for TokenState, BookingStatus, SessionStatus, PaymentStatus, but model files in services do not match schema (extra fields and statuses). This increases the chance of type‑level drift and incorrect assumptions when reusing those models.
- Marketplace and scheduling repositories enforce lifecycle validation (token state transitions, ownership checks, future scheduling), but controller flows are split between two parallel route sets, which can cause divergence in behavior.
- Session completion in repository creates payments and consumes tokens, but the session controller end‑session path does not call that repository method.

## Frontend–Backend Contract Validation
- Frontend authentication assumes role is returned; it falls back to a user‑selected role if role is missing, which can lead to UI role/permission mismatch with the JWT.
- Frontend signup submits `fullName`, but the backend does not persist or return it.
- Core marketplace read flows are wired (browse/details), but purchase, booking, session start/end, payments, metrics, and pricing are not wired in the UI.
- Frontend assumes `durationMinutes` and `price` fields on token responses, which match current backend responses.

## Root Cause Analysis (Top 3 Operational Failures)
1. Marketplace appears empty  
   Root causes:
   - Tokens are minted in `drafted` state and must be explicitly listed; if listing fails or is skipped, they remain invisible to the marketplace.
   - Role mismatch can prevent listing: UI lets any logged‑in user access Create Session, but backend requires `professional` role and rejects others.
2. Signup returns 500  
   Root causes:
   - Backend startup hard‑fails without required environment variables (DATABASE_URL, strong JWT_SECRET), which manifests as 500s or offline API when the frontend tries to sign up.
   - Prisma transaction errors during user creation (e.g., database connectivity or constraint errors) bubble to 500 with generic messaging.
3. “View details” not working consistently  
   Root causes:
   - Details view relies entirely on `/marketplace/tokens/:id`; if the listing endpoint returns tokens that are not actually retrievable (stale IDs, deleted tokens), the details page shows error/empty state.
   - UI has no fallback to handle missing professional/user data beyond a generic error, so partial records degrade the experience without a guided recovery path.

## ✔️ What Is Already Built (and usable)
- Role‑based auth with JWT and protected routes.
- Professional profile auto‑creation on professional registration.
- Token lifecycle endpoints (mint/list/purchase/consume/cancel).
- Marketplace listing and token details endpoints.
- Booking repository with lifecycle validation.
- Session start/end endpoints and payment creation logic in repository.
- Metrics ingestion endpoint and pricing calculation endpoint (placeholder logic).

## ❌ What Is Still Missing (blocking production readiness)
**Missing validations**
- UI‑side enforcement of role and professional eligibility for token creation.
- Consistent enforcement of session completion to payment creation in controller paths.

**Missing lifecycle transitions**
- UI flow to purchase tokens and move to booking and session flows.
- UI flow to start/end sessions and propagate completion into payments.

**Missing data guarantees**
- Consistent typed models aligned to Prisma schema for users, tokens, sessions, and bookings.
- Contract guarantees for user profile data (e.g., full name) across auth flows.

**Missing UX feedback loops**
- Real‑time UI refresh after state changes (purchase, booking, session completion).
- Buyer/professional dashboards connected to live data (currently placeholders).

**Missing environment hardening**
- Clear runtime configuration for API base URLs in production builds.
- Operational checks to surface missing env variables before user‑facing errors.

## Actionable Fix Plan
1. **Stabilize core lifecycle in backend**  
   Make session completion use the repository `completeSession` path and audit consistently; remove or consolidate duplicate scheduling routes.
2. **Align models and contracts**  
   Update service model files to match Prisma schema fields/enums; ensure frontend expects only guaranteed fields.
3. **Wire missing frontend flows**  
   Add purchase, booking, session start/end, and payments retrieval in the UI with clear error and empty states.
4. **Role/permission UX hardening**  
   Enforce role‑appropriate UI entry points and block non‑professional users from token creation routes.
5. **Production readiness**  
   Document required env variables and validate API base URL for production; add startup health checks.
