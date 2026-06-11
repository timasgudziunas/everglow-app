# Everglow — App Plan

## Product Overview

A paired wearable bracelet that reads one partner's heartbeat via a PPG sensor and transmits it to the other partner's bracelet in real time, rendering it as a breathing amber glow. The app handles bracelet pairing, partner linking, and the real-time beat relay. Heartbeat data is end-to-end encrypted, passes through servers as beat timestamps only, and is never stored or logged.

---

## Core Features (priority order)

1. **BLE bracelet pairing** — Scan for nearby bracelet over BLE, pair it to the phone, verify the GATT profile matches. Each partner does this independently on their own device. Firmware and app must agree on the shared GATT base UUID before either side builds.
2. **Beat event reception** — Bracelet detects heartbeats on-device using the PPG sensor and emits a single ~8-byte encrypted beat event per heartbeat over BLE. The phone receives these events — it does not stream raw PPG data. This is the atomic unit the entire system is built on.
3. **User accounts** — Email/phone signup and login. Each partner creates their own account independently.
4. **Partner linking** — One partner generates a short invite code in the app, the other enters it. Backend links the two account IDs permanently. No beat data flows until this link exists.
5. **Real-time beat relay** — Phone receives beat events from bracelet over BLE and forwards them to the backend over a WebSocket connection. Backend routes events to the partner's phone in under 1 second end-to-end. Partner's phone sends the beat event to the partner's bracelet over BLE. Bracelet renders the amber breathing pulse locally. Both directions run simultaneously. Beat timestamps pass through encrypted and are never stored or logged.
6. **Home screen** — Animated heartbeat ring driven by live incoming beat events, BPM display, connection status, four wearing-state variations (both, just you, just partner, neither).
7. **iOS background execution** — The beat relay must stay genuinely alive when the app is backgrounded or the phone locks — relaying real beats, not just idling. iOS suspends the Ably WebSocket on background, so a silent push (APNs `content-available`) wakes the app, which relays the beat to the bracelet over BLE (the `bluetooth-central` background mode keeps the BLE link open). The resting glow on the bracelet is only a degraded fallback for when silent push is unavailable (e.g. credentials not yet configured) or a wake is missed — it is not the intended steady state. Sub-second latency holds during an active session, foreground or background.
8. **Onboarding flow** — Open app → create account → pair bracelet → invite partner or enter partner's code. Must complete in under 3 minutes with no technical knowledge required.
9. **Basic settings** — Quiet hours (bracelet dims after set time), relationship start date, next visit date.

### Nice to have (v2)
- Sleep detection and dark mode home screen
- History screen — weekly shared time chart and heartbeat BPM trace by day
- Together screen — milestones, days together, time together, streak
- Presence screen — partner wear status and local time
- Android version
- Shared day notes

---

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Mobile app | React Native + Expo | Closest to Next.js, full native BLE access on iOS |
| BLE | react-native-ble-plx | Mature, well-documented BLE library for React Native |
| Beat relay | Ably or Pusher | Managed WebSockets, sub-second latency, no infra to maintain |
| Backend API | Next.js on Vercel | Existing comfort zone, handles auth and partner linking |
| Auth + database | Supabase | Removes auth complexity, React Native + Next.js SDKs |

### Key decision: why not Next.js for the mobile app
Next.js runs in a browser. Web Bluetooth is blocked entirely by Safari on iOS — Apple does not allow web apps to access Bluetooth hardware. Since BLE is the core mechanism of the product, a native or near-native mobile app is mandatory. React Native uses the same React mental model as Next.js (components, hooks, JSX) making it the fastest path given existing familiarity.

### GATT profile — locked 2026-06-06
| | UUID |
|---|---|
| Service | `F3640001-5F4E-4B39-9A2E-7D8E1F0A3C5B` |
| Beat event (notify) | `F3640002-5F4E-4B39-9A2E-7D8E1F0A3C5B` |
| Light command (write-without-response) | `F3640003-5F4E-4B39-9A2E-7D8E1F0A3C5B` |

Beat event — 8 bytes, little-endian: `uint32 timestampMs | uint16 intervalMs | uint8 sequence | uint8 checksum (XOR bytes 0–6)`

Light command — 4 bytes, little-endian: `uint8 command (0x00 off, 0x01 pulse) | uint16 durationMs | uint8 brightness (0–255)`

The firmware engineer needs only these UUIDs and byte layouts to build their side.

### Silent push (APNs) — pending credentials, 2026-06-08
Silent-push background relay (Core Feature #7) is fully implemented but **inert until real APNs credentials exist** — the `APNS_*` env vars are `PLACEHOLDER`, so the backend skips the push and the app runs on the foreground-only Ably path exactly as before. Setup steps live in `APNS_SETUP.md`.

Blockers before this path goes live:
- **Apple Developer account + APNs auth key (`.p8`)** → real `APNS_*` values. Until then the relay is foreground-only.
- **On-device verification** — silent push and background BLE writes cannot be exercised on a simulator. Hardware expected mid-to-late June 2026; verify the full backgrounded loop (push wakes app → BLE write reaches bracelet) once it arrives.
- **`useMockBLE` → `useBLE` swap** (Phase 2's open hardware item). The background wake handler pulses the device id registered by `useBLE` via `setConnectedDeviceId`; the mock never registers one, so the background path stays dark until the swap.
- **Token type swap** — `usePushToken` currently registers an Expo push token; switch it to `getDevicePushTokenAsync()` for the raw APNs token when going live (marked in-code, documented in `APNS_SETUP.md`).

When enabling, also revisit `useRelay`'s background branch — it currently pauses outbound forwarding and sends a resting glow on background, which must give way to keeping the real relay alive.

---

## Build Plan

### Phase 1 — Skeleton
- [x] Scaffold React Native + Expo project
- [x] Set up Supabase (auth, database schema for users and partner links)
- [x] Scaffold Next.js backend on Vercel
- [x] Basic account creation and login on mobile

### Phase 2 — Hardware connection
- [x] Lock GATT profile (UUIDs + byte layouts — see above)
- [x] BLE scan, pair, and connect to bracelet
- [x] Receive beat events from bracelet on the phone
- [x] Send light pulse commands back to bracelet
- [ ] Verify the full bracelet ↔ phone loop works on real hardware (`hooks/useMockBLE.ts` stands in until then — swap import in `pair-bracelet.tsx`)

### Phase 3 — Partner sync and relay
- [x] Invite code generation and partner linking
- [x] Ably/Pusher WebSocket integration on backend
- [x] Beat events flow from your bracelet → your phone → backend → partner's phone → partner's bracelet
- [x] Both directions simultaneously

### Phase 4 — Home screen
- [x] Animated heartbeat ring driven by live incoming beat events
- [x] BPM display and connection status
- [x] All four wearing-state variations (both, just you, just partner, neither)

### Phase 5 — Onboarding and polish
- [x] Full onboarding flow (pair bracelet → create account → link partner)
- [x] Resting-glow fallback when backgrounded (degraded mode only — not the primary path)
- [~] Silent-push background relay (APNs) keeps the real relay alive while backgrounded — code complete; pending APNs credentials + on-device verification (see "Silent push (APNs)" above and `APNS_SETUP.md`)
- [x] Quiet hours setting — local-storage window (`lib/quietHours.tsx`), settings UI, gates **both** the foreground relay (`useRelay`) and the background wake handler (`lib/backgroundBeatRelay.ts`) so the bracelet breathes faintly (dim glow) instead of pulsing brightly, even when a silent push wakes the app
- [x] Error states, reconnection logic, edge cases — BLE auto-reconnect with exponential backoff on unexpected disconnect (`useBLE`), Bluetooth-off teardown, scan timeout ("no bracelet found"), and home-screen surfacing of reconnecting / BT-off / error+retry / relay-offline states