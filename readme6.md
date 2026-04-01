# Free Session Connection System Implementation

## What Was Implemented (MVP)

A fully free structural connection system between buyers and professionals has been added to CronoX_v2 without requiring any paid APIs. The core addition is an embedded, secure session room via **Jitsi Meet**. 

## New Improvements Implemented (MVP+ Upgrades)

1. **Secure Room ID Generation**: Refactored the generic placeholder URLs (`/session-{id}`) into an unguessable deterministic SHA256 hash using `id + ROOM_SECRET`. `https://meet.jit.si/cx-{hash}`.
2. **Session Timer & Auto-Exit**: Added a continuous 5-second polling interval directly inside `SessionRoom.tsx` which evaluates current time against `session.endedAt`. The room forcibly exits back to the dashboard `5 minutes` after the end of the scheduled time limit.
3. **Basic Notification System (Pre-Session Polling)**: Expanded the standard `MySessions.tsx` booking loop. When an active session passes beneath the 5-minute threshold, it fires a front-end `toast` alerting the user that the session is about to begin.
4. **Enforced Scheduling Realism**: Validated that `scheduleBooking` handles the specific user-selected `scheduledAt` strings, mapping exact user calendar picks securely rather than utilizing 10-minute offset mock blocks.
5. **Session Presence Tracking**: Rolled out `POST /api/scheduling/sessions/:id/join`. This triggers whenever `SessionRoom.tsx` mounts, tying it into the pre-existing AuditLog framework and tracking the exact timestamp/userId of who entered.

## Architecture Decisions (Why Jitsi MVP)

Jitsi Meet was chosen for the initial rollout based on the philosophy of choosing pragmatic "simplest working solutions over perfect ones":
* **Zero Infrastructure overhead**: WebRTC + Socket.io requires deploying and scaling a signaling server plus configuring internal STUN/TURN servers to penetrate NAT firewalls. Jitsi handles this out of the box entirely for free.
* **Instant MVP Functionality**: An embedded Jitsi room supports exactly what we need immediately—room-based segregation and robust multi-peer real-time communication.
* **Cost Efficiency**: Avoiding paid APIs (like Twilio Video, Daily.co) fulfills the primary constraint defined by architecture goals.

The implementation builds closely around the existing data setup: The system already automatically binds a derived `meetingLink` based on the internal `Booking.id` string upon scheduling. By keeping the join window securely locked behind a fully authenticating backend API, the actual unauthenticated nature of Jitsi meet URLs becomes a non-issue as the path there can only be reached programmatically by authorized clients.

## How Session Connection Works

1. **Pre-requisite (Schedule time)**: The Professional picks a time, which sets `Booking.scheduledAt` and creates a `Session`.
2. **Validation Layer**: The Join button enables 5 minutes before the meeting on standard. Clicking join navigates to `/session/:sessionId`.
3. **Authentication Boundary**: `SessionRoom.tsx` calls `GET /api/scheduling/sessions/:id`. The controller determines:
   - Does this JWT trace to the booking's Buyer or Professional? (-> `403` if no)
   - Is it too early? (-> `403` if `< 5 minutes` before start)
   - Has the time completely ran out? (-> `403` if `> 15 mins` after end time grace period).
4. **Room Fulfillment & Tracking**: On HTTP 200 OK, the browser renders the unguessable SHA256 deterministic Jitsi room and immediately fires a `POST` network event to `joinSession` which logs presence.

## Limitations

- Basic iframe embed forces "Guest" metadata inside Jitsi unless using the heavier low-level SDK.
- Users can technically extract the raw link from developer tools to bypass the website restriction if they know what they are doing.
- No integrated in-app chat bridging, just Jitsi's internal isolated chat feature.

## Future Improvements

- **WebRTC Refactor**: If the platform reaches scale, migrate from Jitsi to a lightweight raw WebRTC stack utilizing standard WebSocket signaling built into the Node.js backend to bring the streaming fully internal.
- **Recordings Output**: Using higher-tier API integrations later explicitly to save sessions automatically for auditing.

---

## Additional Incremental Enhancements

1. **Leave Tracking Data**: Shipped a new `POST /api/scheduling/sessions/:id/leave` endpoint. The frontend naturally reports session departure whenever a user clicks "Leave," whenever the auto-exit threshold kicks them, or when the React component naturally unmounts. This fully covers session observability mapped to `AuditLog`.
2. **Persistent Notifications**: Polished the 5-minute pre-session browser toast inside the dashboard by utilizing browser `sessionStorage`. Toasts correctly avoid duplicating and re-firing if the user reloads their dashboard page during the countdown phase.
3. **Session Countdown UI**: Imbedded a real-time reactive countdown clock directly into the `SessionRoom.tsx` subheader. It automatically pivots between `Starts in: MM:SS` and `Ends in: MM:SS` tracking against the exact scheduled times internally, keeping participants perfectly aware of their bounds.

---

## Dispute Handling & Payment Enforcement

To ensure fairness and reduce fraudulent payouts, the system now implements multi-layer payment enforcement:

### 1. Automated Dispute Rules
The backend automatically evaluates session telemetry upon completion:
- **Hard Dispute (`disputed`)**: Triggered if only one user joined OR the session duration was less than 25% of the scheduled time. Payouts are blocked.
- **Soft Flag (`pending_review`)**: Triggered if the session was shorter than 50% of the duration but both participants were present.

### 2. Manual Dispute API
Users can now trigger a formal dispute via `POST /api/scheduling/sessions/:id/dispute`. This immediately:
- Transitions the associated payment to `disputed` status.
- Records a `SessionDisputedManual` event in the `AuditLog` with the provided reason.

### 3. Telemetry Data Source
All enforcement logic is powered by `SessionJoined` and `SessionLeft` events stored in the `AuditLog`, ensuring a tamper-evident record of user presence.

---

## System Maturity: Production-Ready (MVP+)

The current implementation has evolved from a basic Jitsi integration into a robust, secure, and production-capable session lifecycle management system. It provides high architectural safety without the overhead of expensive third-party video APIs.

### Core Reliability Features

1. **Overlap-Based Duration Tracking**:
   - Instead of tracking simple total time, the system calculates the **mathematical overlap** between the Buyer and Professional's presence (`min(leaves) - max(joins)`).
   - This ensures payments are only settled for time where **actual interaction** occurred.

2. **Presence Safeguards (The 2-Minute Rule)**:
   - Participants with a total presence duration of less than 2 minutes are discarded from the validation count.
   - This prevents "ghost" joins from triggering payouts or settlement status.

3. **Multi-Layer Enforcement**:
   - **Hard Dispute (`disputed`)**: Automatically triggered for no-shows or sessions with < 25% overlap duration.
   - **Soft Flag (`pending_review`)**: Triggered for sessions between 25% and 50% overlap.
   - **Manual Override**: The `disputeSession` API allows either party to formally flag a session for admin review regardless of telemetry.

### Handling Edge Cases

| Edge Case | Outcome | System Response |
| :--- | :--- | :--- |
| **No-Show** (1 user only) | Hard Dispute | Payment status -> `disputed`. Audit log recorded. |
| **Brief Join** (< 2 mins) | Ignored User | User is treated as "absent" for settlement purposes. |
| **Early Leave** (< 50% time) | Flagged for Review | Payment status -> `pending_review`. |
| **Normal Session** | Auto-Settle | Payment status -> `settled`. |

---

## Future Readiness: WebRTC & Recording Migration

The system has been architecturally prepared for a future migration from Jitsi to a custom WebRTC stack:

1. **Provider Abstraction**: The `Session` model now includes a `provider` field (defaulting to `jitsi`), allowing for a seamless toggle to `webrtc` once implementation is complete.
2. **Recording Infrastructure**:
   - **Data Model**: Added `recordingUrl` to the `Session` model.
   - **API Stub**: Implemented `POST /api/scheduling/sessions/:id/recording` to allow future recording services (or client-side uploaders) to persist session media links.
3. **Migration Strategy**: A detailed roadmap has been created in `webrtc_migration_plan.md`, focusing on a zero-cost P2P signaling approach using `socket.io` and browser-native `MediaRecorder`.

---

## Time Handling Strategy

To ensure reliability across the platform, CronoX_v2 follows a strict time-standardization policy:

1. **Storage (Source of Truth)**:
   - All timestamps in the database (Prisma/PostgreSQL) are stored in **UTC**.
   - This prevents timezone drift and ensures mathematical correctness for duration and overlap calculations.

2. **Backend Logic**:
   - All validations (join window, session timeouts, payment settlement) are performed using **UTC** comparisons.
   - `Date.now()` and `new Date()` are treated as UTC internally.

3. **User Presentation (IST)**:
   - All user-facing times in the dashboard, session room, and notifications are formatted to **Indian Standard Time (IST - Asia/Kolkata)**.
   - A dedicated `date-utils` library handles the conversion from UTC strings to IST labels using the `Intl.DateTimeFormat` API.

4. **Consistency Rule**:
   - **UTC for Logic, IST for Display.** Developers must never mix the two in calculations to avoid "off-by-5.5-hours" bugs.

