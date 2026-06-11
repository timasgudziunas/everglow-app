import { useEffect, useRef, useState } from 'react';
import * as Ably from 'ably';
import { useSession } from '../lib/auth';
import { useQuietHours, isWithinQuietHours, QUIET_HOURS_BRIGHTNESS } from '../lib/quietHours';
import type { BeatEvent, LightCommand } from './useBLE';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export type RelayState = 'idle' | 'connecting' | 'connected' | 'error';

// Bridges BLE ↔ backend ↔ partner's phone.
// - Forwards each outbound beat to /api/relay (fire-and-forget per beat).
// - Subscribes to beats:{userId} on Ably and pulses the bracelet on arrival.
// - When isBackground=true, sends a resting glow to the bracelet and pauses
//   outbound forwarding (iOS suspends the network socket anyway).
export function useRelay({
  latestBeat,
  sendLightCommand,
  isBackground = false,
}: {
  latestBeat: BeatEvent | null;
  sendLightCommand: (cmd: LightCommand) => Promise<void>;
  isBackground?: boolean;
}): { relayState: RelayState; lastRelayError: string | null; latestPartnerBeat: BeatEvent | null } {
  const { session } = useSession();
  const [relayState, setRelayState] = useState<RelayState>('idle');
  const [lastRelayError, setLastRelayError] = useState<string | null>(null);
  const [latestPartnerBeat, setLatestPartnerBeat] = useState<BeatEvent | null>(null);

  // Stable ref so the Ably subscription closure never captures a stale callback
  const sendLightCommandRef = useRef(sendLightCommand);
  useEffect(() => { sendLightCommandRef.current = sendLightCommand; }, [sendLightCommand]);

  // Latest quiet-hours window, mirrored into a ref so the long-lived Ably and
  // background closures always read the current value without re-subscribing.
  const { quietHours } = useQuietHours();
  const quietHoursRef = useRef(quietHours);
  useEffect(() => { quietHoursRef.current = quietHours; }, [quietHours]);

  // Sequence tracking to avoid double-posting the same beat
  const lastSequenceRef = useRef<number>(-1);

  // When app moves to background, send a dim long-duration pulse to the bracelet.
  // BLE Central stays active under the bluetooth-central background mode, so the
  // write goes through even though the network relay is suspended by iOS.
  useEffect(() => {
    if (isBackground) {
      const brightness = isWithinQuietHours(quietHoursRef.current) ? QUIET_HOURS_BRIGHTNESS : 50;
      sendLightCommandRef.current({ command: 0x01, durationMs: 30_000, brightness });
    }
  }, [isBackground]);

  // Open an Ably Realtime connection for the duration the user has a session.
  // Re-connects automatically if the access token is refreshed.
  useEffect(() => {
    if (!session) return;

    setRelayState('connecting');

    const client = new Ably.Realtime({
      authCallback: async (_params, callback) => {
        try {
          const res = await fetch(`${API_URL}/api/ably-auth`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (!res.ok) throw new Error(`ably-auth ${res.status}`);
          callback(null, await res.json());
        } catch (err) {
          callback(err instanceof Error ? err.message : String(err), null);
        }
      },
    });

    client.connection.on('connected', () => {
      setRelayState('connected');
      setLastRelayError(null);
    });
    client.connection.on('failed', () => {
      setRelayState('error');
      setLastRelayError('Relay connection failed');
    });
    client.connection.on('disconnected', () => setRelayState('connecting'));

    // Subscribe to incoming partner beats
    const channel = client.channels.get(`beats:${session.user.id}`);
    channel.subscribe('beat', (message: Ably.Message) => {
      const beat = message.data as BeatEvent;
      setLatestPartnerBeat(beat);
      // During quiet hours the bracelet still breathes with the partner's beat, just faintly.
      const brightness = isWithinQuietHours(quietHoursRef.current) ? QUIET_HOURS_BRIGHTNESS : 200;
      sendLightCommandRef.current({
        command: 0x01,
        durationMs: beat.intervalMs,
        brightness,
      });
    });

    return () => {
      channel.unsubscribe();
      client.close();
      setRelayState('idle');
    };
  }, [session?.access_token]);

  // Forward each new outbound beat to the backend relay (skipped when backgrounded)
  useEffect(() => {
    if (!latestBeat || !session || isBackground) return;
    if (latestBeat.sequence === lastSequenceRef.current) return;
    lastSequenceRef.current = latestBeat.sequence;

    fetch(`${API_URL}/api/relay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(latestBeat),
    }).catch(() => {
      // Individual beat loss is acceptable — no retry, don't disrupt the stream
    });
  }, [latestBeat, session]);

  return { relayState, lastRelayError, latestPartnerBeat };
}
