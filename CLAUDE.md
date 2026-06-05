# Everglow — Codebase Guide

Paired wearable bracelet app. One partner's heartbeat is read by a PPG sensor in the bracelet and sent as a breathing amber glow to the other partner's bracelet in real time. Beat timestamps pass through end-to-end encrypted and are never stored.

---

## Monorepo structure

```
everglow-app/
├── apps/
│   ├── mobile/          # React Native + Expo (iOS first)
│   └── api/             # Next.js on Vercel (backend API)
├── packages/
│   └── shared/          # Shared TypeScript types (BeatEvent, WearingState, etc.)
├── PLAN.md              # Full product plan and build phases
└── CLAUDE.md            # This file
```

---

## Apps

### `apps/mobile` — React Native + Expo

**Entry point:** `expo-router/entry` (file-based routing, like Next.js App Router)

**Screen structure:**
```
app/
├── _layout.tsx                    # Root navigator (Stack)
├── onboarding/
│   ├── _layout.tsx
│   ├── index.tsx                  # Welcome
│   ├── pair-bracelet.tsx          # BLE scan and pairing
│   └── link-partner.tsx           # Invite code entry
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── signup.tsx
└── (tabs)/
    ├── _layout.tsx
    ├── index.tsx                  # Home — animated heartbeat ring
    └── settings.tsx               # Quiet hours, dates
```

**Key lib files:**
- `lib/supabase.ts` — Supabase client configured for React Native (AsyncStorage persistence)
- `lib/ble.ts` — BleManager singleton + GATT UUID constants (placeholders until firmware is finalized)

**Key dependencies:**
- `expo-router` — file-based navigation
- `react-native-ble-plx` — BLE scanning and GATT communication
- `@supabase/supabase-js` — auth and database
- `react-native-url-polyfill` — required for Supabase on React Native (imported in `app/_layout.tsx`)

**Running:**
```
cd apps/mobile && npm install && npx expo start
```
iOS only for BLE — Safari blocks Web Bluetooth entirely.

---

### `apps/api` — Next.js on Vercel

**Routes:**
```
app/
├── layout.tsx
├── page.tsx                       # Health check / landing
└── api/
    ├── partner/route.ts           # POST — invite code generation + partner linking
    └── relay/route.ts             # POST — beat event relay (Ably/Pusher in Phase 3)
```

**Key lib files:**
- `lib/supabase-server.ts` — server-side Supabase client using `@supabase/ssr`

**Required env vars:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

**Running:**
```
cd apps/api && npm install && npm run dev
```

---

## `packages/shared`

TypeScript types shared between mobile and API:
- `BeatEvent` — the ~8-byte unit transmitted from bracelet → phone → backend → partner's phone
- `WearingState` — `'both' | 'you_only' | 'partner_only' | 'neither'`
- `PartnerLink` — database row shape

---

## Critical constraint before Phase 2

The GATT profile (service UUID, beat event characteristic, light command characteristic) **must be agreed with the firmware engineer** before writing any BLE code. The current UUIDs in `apps/mobile/lib/ble.ts` are placeholders.

---

## Build phases

See `PLAN.md` for the full phased plan. Summary:
- **Phase 1** (current): skeleton scaffold
- **Phase 2**: BLE bracelet connection and beat event reception
- **Phase 3**: partner linking and beat relay via Ably/Pusher
- **Phase 4**: animated home screen
- **Phase 5**: onboarding flow, iOS background execution, polish
