import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { sendLightCommandToBracelet } from './ble';
import { isWithinQuietHours, loadQuietHours, QUIET_HOURS_BRIGHTNESS } from './quietHours';

export const BACKGROUND_BEAT_RELAY = 'BACKGROUND_BEAT_RELAY';

// Beat event carried in the silent push payload. Mirrors the backend BeatEvent and
// GATT.BEAT_EVENT_CHARACTERISTIC layout — kept local so this module has no React deps.
type BeatPayload = {
  timestampMs: number;
  intervalMs: number;
  sequence: number;
  checksum: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function isBeat(value: unknown): value is BeatPayload {
  const b = asRecord(value);
  return (
    !!b &&
    typeof b.timestampMs === 'number' &&
    typeof b.intervalMs === 'number' &&
    typeof b.sequence === 'number' &&
    typeof b.checksum === 'number'
  );
}

// The relay sends the beat under the `beat` key of the silent push payload. iOS /
// Expo can surface that payload at a few different nesting depths depending on the
// delivery path, so probe the known locations defensively.
function extractBeat(data: unknown): BeatPayload | null {
  const root = asRecord(data);
  if (!root) return null;

  const candidates: unknown[] = [
    root.beat,
    asRecord(root.body)?.beat,
    asRecord(root.data)?.beat,
    asRecord(asRecord(asRecord(asRecord(root.notification)?.request)?.content)?.data)?.beat,
  ];

  for (const candidate of candidates) {
    if (isBeat(candidate)) return candidate;
  }
  return null;
}

// This is the core background wake handler — this is what makes the relay work when
// the app is not in the foreground. A silent APNs push (content-available) wakes the
// app, iOS runs this task, and we pulse the partner's heartbeat onto the bracelet
// over the still-alive BLE link (kept open by the bluetooth-central background mode).
//
// Defined at module scope (not inside a component) so it is registered with the
// native task system as soon as this module is imported during app startup.
TaskManager.defineTask(BACKGROUND_BEAT_RELAY, async ({ data, error }) => {
  if (error) return;
  const beat = extractBeat(data);
  if (!beat) return;

  // Quiet hours: the bracelet still breathes with the partner's beat, just faintly.
  // Read from local storage — no network/auth, so it stays off the relay's critical path.
  const brightness = isWithinQuietHours(await loadQuietHours()) ? QUIET_HOURS_BRIGHTNESS : 200;

  try {
    await sendLightCommandToBracelet({
      command: 0x01,
      durationMs: beat.intervalMs,
      brightness,
    });
  } catch {
    // A single dropped beat is acceptable — never throw out of a background task.
  }
});

// Subscribe the background task to incoming (silent) push notifications. Idempotent:
// safe to call on every app launch.
export async function registerBackgroundBeatRelay(): Promise<void> {
  try {
    await Notifications.registerTaskAsync(BACKGROUND_BEAT_RELAY);
  } catch {
    // Registration can fail on simulators / when push isn't available — ignore.
  }
}
