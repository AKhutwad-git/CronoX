# CronoX_v2 Technical Research and Implementation Report

## Scope and Method
This report analyzes the CronoX_v2 codebase with emphasis on backend services, frontend application flow, data models, and architectural maturity. Findings are derived from direct inspection of key source files across frontend (`src/`) and backend (`backend/src/`) along with the Prisma schema (`backend/prisma/schema.prisma`). Where behavior is inferred rather than explicitly implemented, the report calls out assumptions.

## 1. Project and Codebase Analysis

### 1.1 Repository Structure (High-Level)
- `src/`: React + Vite frontend (buyer/professional flows, marketplace UI).
- `backend/`: Express + Prisma backend (auth, marketplace, scheduling, payments, pricing, metrics, auditing).
- `backend/prisma/`: Database schema and migrations.
- `diff_project_file/`: Separate project (not part of CronoX core).

### 1.2 Frontend Modules (File-by-File, Major Components)

#### Entry Points and Routing
- `src/main.tsx`: Bootstraps the React app and clears stored tokens on load, which forces users to be logged out on every refresh.
- `src/App.tsx`: Defines routing, role-based access via `RoleGuard`, and mounts global providers (react-query, tooltips, toasters).

#### Global State and API Layer
- `src/contexts/RoleContext.tsx`: Stores auth token and infers role from JWT payload. Role can also be set manually when no token is present.
- `src/lib/api.ts`: Centralized API helper; automatically injects `Authorization` and `X-Correlation-ID` headers; handles 401 by clearing tokens and redirecting.

#### Pages and Flows
- `src/pages/Index.tsx`: Marketing landing page, onboarding CTA for buyer/professional.
- `src/pages/AuthEntry.tsx`: Entry selector for buyer vs professional roles.
- `src/pages/SignUp.tsx`: Registration flow; submits to backend `/auth/signup`.
- `src/pages/SignIn.tsx`: Login flow; submits to backend `/auth/login`.
- `src/pages/Dashboard.tsx`: Professional dashboard (bookings, payments, stats) and buyer dashboard stub.
- `src/pages/Marketplace.tsx`: Lists available time tokens (`/marketplace/tokens`).
- `src/pages/MarketplaceTokenDetails.tsx`: Token details, purchase, booking, and immediate session start/end handling.
- `src/pages/MySessions.tsx`: Upcoming/completed sessions; professional can start/end sessions.
- `src/pages/CreateSession.tsx`: Professional session creation; mints and lists time tokens.
- `src/pages/Earnings.tsx`: Aggregates payments and session data.
- `src/pages/Profile.tsx`: Static profile UI with placeholders.
- `src/pages/NotFound.tsx`: Basic 404 page.

#### Shared Components
- `src/components/layout/Navbar.tsx` and `Footer.tsx`: Navigation and footer.
- `src/components/ui/*`: Shadcn-based UI component library.
- `src/hooks/*`: UI helpers (toast, responsive detection).

#### Frontend Observations
- Token is cleared on app start; this breaks persistent login.
- Create Session form collects title/description but backend does not store them.
- Marketplace booking flow auto-starts and ends a session immediately after booking, which is likely demo behavior and not a production workflow.

### 1.3 Backend Modules (File-by-File, Major Components)

#### Entry Point and Core Services
- `backend/src/index.ts`: Express server startup, middleware, route registration, database connectivity checks.
- `backend/src/lib/config.ts`: Environment validation, JWT config, and server config.
- `backend/src/lib/prisma.ts`: Prisma client with PostgreSQL adapter and logging hooks.
- `backend/src/lib/logger.ts`: JSON-style logging to stdout/stderr.
- `backend/src/lib/base-repository.ts`: Generic repository abstraction.

#### Middleware
- `backend/src/middleware/auth.middleware.ts`: JWT authentication with `Authorization` header.
- `backend/src/middleware/role.middleware.ts`: Role-based authorization.
- `backend/src/middleware/correlation.middleware.ts`: Adds correlation IDs for tracing.
- `backend/src/middleware/error.middleware.ts`: Global error handling and 404 response.

#### User and Auth Services
- `backend/src/services/users/auth.routes.ts`: `/auth/login` and `/auth/register`.
- `backend/src/services/users/auth.controller.ts`: Handles login/register with bcrypt and JWT.
- `backend/src/services/users/user.routes.ts`: User CRUD endpoints and professional lookup.
- `backend/src/services/users/user.controller.ts`: User creation and lookup.
- `backend/src/services/users/user.repository.ts`: User data access with validation.
- `backend/src/services/users/professional.repository.ts`: Professional profile access.

#### Marketplace Services
- `backend/src/services/marketplace/marketplace.routes.ts`: Token listing, purchase, state transitions.
- `backend/src/services/marketplace/marketplace.controller.ts`: Mint, list, purchase, consume, cancel, and order retrieval.
- `backend/src/services/marketplace/time-token.repository.ts`: Token repository and validation logic.
- `backend/src/services/marketplace/marketplace-order.repository.ts`: Order creation with transactional state transition and audit.

#### Scheduling Services
- `backend/src/services/scheduling/scheduling.routes.ts`: Booking endpoints.
- `backend/src/services/scheduling/session.routes.ts`: Session lifecycle endpoints.
- `backend/src/services/scheduling/scheduling.controller.ts`: Booking creation and cancellation.
- `backend/src/services/scheduling/session.controller.ts`: Session start/end workflow.
- `backend/src/services/scheduling/booking.repository.ts`: Booking with validation and session creation.
- `backend/src/services/scheduling/session.repository.ts`: Session data access; auto-creates a payment on completion.

#### Payments and Pricing
- `backend/src/services/payments/payment.routes.ts`: Payment queries for authenticated user.
- `backend/src/services/payments/payment.controller.ts`: Payment aggregation by role; settlement stub.
- `backend/src/services/payments/erp.service.ts`: Mock ERP integration (simulated invoice creation).
- `backend/src/services/pricing/pricing.routes.ts`: Pricing endpoint.
- `backend/src/services/pricing/pricing.controller.ts`: Placeholder pricing using random modifiers.

#### Metrics and Auditing
- `backend/src/services/metrics/metrics.routes.ts`: Metrics create endpoint.
- `backend/src/services/metrics/metrics.controller.ts`: Writes metrics into Prisma.
- `backend/src/services/auditing/audit.controller.ts`: Writes audit logs (partially aligned with schema).
- `backend/src/services/auditing/audit-log.repository.ts`: Audit log repository with read-only semantics.
- `backend/src/services/auditing/auditing.routes.ts`: Admin-only audit log access.
- `backend/src/event.bus.ts`: In-memory event bus that emits audit logs, not wired into core flows.

### 1.4 Data Model Summary (Prisma)
Core entities: `User`, `Professional`, `TimeToken`, `MarketplaceOrder`, `Booking`, `Session`, `Payment`, `Metric`, `FocusScore`, `AuditLog`. Relationships support a marketplace flow where a professional mints time tokens, buyers purchase tokens, create bookings, and sessions create payments upon completion.

Key observations:
- `Metric` uses `metricType` and `value` (Decimal). Application code models metrics as generic `type`/`value`, which can represent biometrics but does not enforce a typed schema.
- `FocusScore` exists in the database but is not used in runtime flows.
- `Payment` is linked to `Session` and can be created automatically in `SessionRepository.completeSession`.
- `AuditLog` is immutable and stores generic JSON metadata.

### 1.5 Architectural Gaps, Incomplete Logic, and Technical Debt

#### Authentication and Session State
- Frontend clears tokens on boot, which defeats persistent login.
- No refresh tokens, token rotation, password reset, or email verification.
- Client role is selectable before authentication, which is fragile and bypassable.

#### Data Model and Code Mismatches
- `AuditLog` schema does not match `audit.model.ts` (missing actor/eventId).
- `BaseRepository.delete` assumes a `deletedAt` field that does not exist in Prisma schema.
- `metrics.model.ts` is not aligned with Prisma fields (`metricType`, `recordedAt`).

#### Marketplace Workflow Gaps
- No availability or calendar constraints; token represents only duration and price.
- Session booking auto-starts and auto-completes in the frontend, which is not realistic.
- No refund or cancellation policy enforcement; cancel simply flips state.

#### Pricing and Payments
- Pricing logic uses random factors and placeholder focus score.
- ERP integration is mocked and not used for real settlement flows.
- No idempotency or reconciliation for payment processing.

#### Observability and Reliability
- Logging exists but no structured tracing, metrics, or centralized logging.
- Event bus exists in memory but is not integrated with core flows or persistence.

#### Security and Compliance
- No rate limiting, input validation layer, or audit trails for auth changes.
- CORS defaults to allow all origins.
- No explicit handling for PII or health-related data governance.

## 2. Missing and Required Features for Production Readiness

### Core Functionality
- Session content and metadata (title, description, topics, expertise tags).
- Availability scheduling and time slot management.
- Refund, cancellation, and dispute workflows.
- Professional profile verification and skill taxonomy.

### Backend / Infrastructure
- Durable background jobs (payment settlement, notifications).
- Idempotent payment processing with a real gateway.
- Webhook handling for payments and external systems.
- CI/CD, migrations in deployment pipeline, and seed data tooling.

### Frontend / UX
- Persistent login and secure token handling.
- Profile editing and onboarding completion flows.
- Error states for each critical user journey.
- Search/filtering with server-side pagination for marketplace.

### Security & Compliance
- Password reset, email verification, and MFA support.
- Audit trail for critical actions (auth, payment, pricing).
- Rate limiting, WAF rules, and abuse prevention.
- Health data compliance policies if biometrics are introduced.

### Performance & Scalability
- Pagination and caching on listings and history endpoints.
- Read-model optimization for marketplace listings and analytics.
- Observability stack (metrics, tracing, logs) for runtime visibility.

## 3. Real-Time Biometric Monitoring System (HRV and Sleep)

### Architectural Approaches
1. **Mobile SDK + Wearable APIs**
   - Use mobile apps to connect to Apple HealthKit and Google Fit.
   - Integrate wearable vendors via APIs: Fitbit, Garmin, Oura, Whoop.
2. **Device SDK with Streaming**
   - Use vendor SDKs that stream HRV or sleep data in near real-time.
3. **Hybrid Batch + Realtime**
   - Realtime signals for HRV; batch uploads for sleep summaries.

### Data Sources
- Apple HealthKit, Google Fit
- Wearables: Oura, Fitbit, Garmin, Whoop, Polar
- Medical-grade sensors (if enterprise use cases exist)

### Data Ingestion Methods
- OAuth-based API access for vendors that provide REST webhooks.
- Mobile app uploads via secure API endpoints.
- Webhooks from vendor APIs for daily summaries and anomalies.

### Real-Time Processing Techniques
- Stream ingestion via message queue (Kafka, SQS, or NATS).
- Windowed aggregation for HRV (rolling 5–15 minute windows).
- Sleep staging computed in batch nightly with anomaly alerts.

### Storage Models
- Time-series store for raw HRV metrics (Postgres + Timescale or InfluxDB).
- Aggregates stored in `Metric` and `FocusScore`.
- Personally identifiable metadata stored separately with encryption at rest.

### Privacy, Security, Compliance
- Explicit consent management for each data source.
- Encryption at rest and in transit; field-level encryption for identifiers.
- Retention policies and right-to-erasure workflows.
- HIPAA/GDPR preparedness for health data governance.

### Integration with CronoX
- Extend `Metric` types to include `hrv`, `sleep_duration`, `sleep_quality`.
- Introduce a `BiometricIngestion` service to normalize data inputs.
- Update pricing pipeline to incorporate `FocusScore` derived from biometrics.
- Add UI dashboards for professionals to view biometrics and derived scores.

## 4. Video and Audio Conferencing Integration

### Feasibility
Feasible, but operationally complex. CronoX can embed conferencing with third-party providers or self-hosted infrastructure. Real-time media requires TURN servers, session signaling, and strict security controls.

### Options
1. **Managed Platforms (Recommended)**
   - Services: Twilio, Daily, Agora, Vonage.
   - Pros: Faster integration, global scaling, built-in recording.
   - Cons: Ongoing cost, vendor lock-in.
2. **Self-Hosted WebRTC (Advanced)**
   - Use Jitsi or custom WebRTC signaling servers.
   - Pros: Full control, no vendor lock-in.
   - Cons: Higher operational and maintenance cost.

### Backend Requirements
- Session-to-room mapping stored in DB (meetingId, join tokens).
- Webhook handlers for call state events.
- Secure signaling endpoints (WebSocket) if self-hosted.

### Frontend Requirements
- Embedded video UI with pre-call checks.
- Real-time indicators for mute/camera/screen sharing.
- Session-end triggers integrated with payment and session completion.

### Security and Scalability
- TURN/STUN management and bandwidth policies.
- Token-based room access with TTL.
- Recorded media storage with consent logging.

## 5. Ordered Implementation Roadmap (Low to High Complexity)

1. **Stabilize Auth and Core UX**
   - Objectives: Persistent login, correct role handling, reliable navigation.
   - Tools: React state fixes, JWT parsing, API error boundaries.
   - Outcome: Usable onboarding and stable sessions.

2. **Backend and Schema Alignment**
   - Objectives: Fix model mismatches, implement missing fields, add validations.
   - Tools: Prisma migrations, schema validation, unit tests.
   - Outcome: Reliable data integrity and predictable API contracts.

3. **Marketplace Workflow Hardening**
   - Objectives: Availability management, cancel/refund flow, session lifecycle.
   - Tools: Calendar models, background jobs, notifications.
   - Outcome: Production-grade booking lifecycle.

4. **Payments and Settlement**
   - Objectives: Real payment gateway integration, idempotency, reconciliation.
   - Tools: Stripe/Razorpay APIs, webhook verification.
   - Outcome: Reliable transaction handling and payout tracking.

5. **Pricing Engine Upgrade**
   - Objectives: Replace randomness with real model inputs and scoring.
   - Tools: Feature store, scoring service, audit trails.
   - Outcome: Transparent dynamic pricing based on measurable inputs.

6. **Observability and Operations**
   - Objectives: Metrics, tracing, alerting, error tracking.
   - Tools: OpenTelemetry, Prometheus, Sentry.
   - Outcome: Operational visibility and faster incident response.

7. **Biometric Monitoring Service**
   - Objectives: HRV/sleep ingestion and scoring pipeline.
   - Tools: Mobile SDKs, vendor APIs, stream processing.
   - Outcome: Real-time focus scoring and biometrics-driven pricing signals.

8. **Video/Audio Conferencing**
   - Objectives: Real-time media sessions tied to booked time tokens.
   - Tools: WebRTC provider or self-hosted Jitsi.
   - Outcome: Fully integrated session delivery.

## 6. Evaluation Criteria and Expected Outcomes

### Technical Feasibility
- Can the feature run under expected load and data volume?
- Is it consistent with the existing technology stack?

### Performance
- API response time, ingestion latency for biometrics, conferencing stability.

### Maintainability
- Clear boundaries between services and frontend modules.
- Schema migration readiness and test coverage.

### Security and Compliance
- Meets privacy requirements for biometric data.
- Proper authorization and audit logging for sensitive operations.

### Expected Outcomes
- Phase 1–2: Reliable core marketplace and auth flow.
- Phase 3–5: Complete production business workflow with real payments.
- Phase 6–8: Advanced differentiation via biometrics and conferencing.

### Recommended Next Actions
- Fix auth persistence and client role handling.
- Align Prisma schema with audit and metric models.
- Implement backend validation and error contracts.

## 7. Uncertainties and Assumptions
- No deployment or CI/CD configuration is visible in the repository.
- External integrations (payment gateways, biometrics, conferencing) are not implemented and require vendor selection.
- The event bus is currently in-memory and not integrated with production message queues.

## 8. Final Notes
CronoX_v2 has a solid foundation for a time-token marketplace. The backend schema aligns with the marketplace flow, and the frontend provides rich UX for buyers and professionals. The system is not yet production-ready due to authentication persistence issues, placeholder pricing logic, and missing infrastructure for payments, compliance, and real-time features. With a structured roadmap and targeted refactoring, the project can mature into a scalable platform that supports biometric-driven pricing and integrated conferencing.
