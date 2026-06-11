import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { State } from 'react-native-ble-plx';
import { HeartbeatRing } from '../../components/HeartbeatRing';
import { useMockBLE } from '../../hooks/useMockBLE';
import { useRelay } from '../../hooks/useRelay';
import { useAppState } from '../../hooks/useAppState';
import type { WearingState } from '../../hooks/useBLE';

const AMBER = '#F59E0B';
const BPM_WINDOW = 5;
const PARTNER_STALE_MS = 10_000;

function statusLabel(state: WearingState, deviceName?: string | null): string {
  switch (state) {
    case 'both':         return deviceName ?? 'Connected';
    case 'you_only':     return 'Partner not wearing';
    case 'partner_only': return 'Your bracelet not connected';
    case 'neither':      return 'Neither wearing';
  }
}

// Phase 5: replace useMockBLE with global BLE context from onboarding flow.
export default function HomeScreen() {
  const { btState, devices, scanState, connectedDevice, latestBeat, errorMessage, startScan, connectToDevice, sendLightCommand } = useMockBLE();
  const { isBackground } = useAppState();
  const { latestPartnerBeat, relayState } = useRelay({ latestBeat, sendLightCommand, isBackground });

  const intervalBuffer = useRef<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);

  const partnerLastBeatTime = useRef<number>(0);
  const [partnerWearing, setPartnerWearing] = useState(false);

  useEffect(() => {
    startScan();
  }, []);

  useEffect(() => {
    if (devices.length > 0 && scanState === 'scanning') {
      connectToDevice(devices[0]);
    }
  }, [devices, scanState]);

  // Update rolling BPM and mark partner as wearing on each incoming beat
  useEffect(() => {
    if (!latestPartnerBeat) return;
    const buf = intervalBuffer.current;
    buf.push(latestPartnerBeat.intervalMs);
    if (buf.length > BPM_WINDOW) buf.shift();
    setBpm(Math.round(60000 / (buf.reduce((s, v) => s + v, 0) / buf.length)));
    partnerLastBeatTime.current = Date.now();
    setPartnerWearing(true);
  }, [latestPartnerBeat?.sequence]);

  // Mark partner as not wearing when beats go stale
  useEffect(() => {
    const interval = setInterval(() => {
      if (partnerLastBeatTime.current > 0 && Date.now() - partnerLastBeatTime.current > PARTNER_STALE_MS) {
        setPartnerWearing(false);
        setBpm(null);
        intervalBuffer.current = [];
        partnerLastBeatTime.current = 0;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const youWearing = scanState === 'connected';
  const wearingState: WearingState =
    youWearing && partnerWearing ? 'both' :
    youWearing                   ? 'you_only' :
    partnerWearing               ? 'partner_only' :
    'neither';

  // Ring and BPM are driven by partner's beat; silent when no partner beat
  const beatForRing = wearingState === 'both' || wearingState === 'partner_only' ? latestPartnerBeat : null;
  const bpmForRing  = wearingState === 'both' || wearingState === 'partner_only' ? bpm : null;

  const notice = connectionNotice(btState, scanState, errorMessage);

  return (
    <View style={styles.container}>
      <HeartbeatRing beat={beatForRing} bpm={bpmForRing} wearingState={wearingState} />
      <Text style={styles.status}>{statusLabel(wearingState, connectedDevice?.name)}</Text>

      {notice && (
        <View style={styles.notice}>
          {notice.spinner && <ActivityIndicator color={AMBER} style={styles.noticeSpinner} />}
          <Text style={styles.noticeText}>{notice.text}</Text>
          {notice.showRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={startScan}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Relay trouble is non-fatal — the bracelet keeps the last glow; just hint at it */}
      {scanState === 'connected' && relayState === 'error' && (
        <Text style={styles.relayNotice}>Relay offline — reconnecting…</Text>
      )}
    </View>
  );
}

type Notice = { text: string; showRetry: boolean; spinner: boolean };

function connectionNotice(
  btState: State,
  scanState: string,
  errorMessage: string | null
): Notice | null {
  if (btState === State.PoweredOff) {
    return { text: 'Bluetooth is off — turn it on to feel your partner.', showRetry: false, spinner: false };
  }
  if (btState === State.Unauthorized) {
    return { text: 'Bluetooth permission denied — enable it in Settings → Everglow.', showRetry: false, spinner: false };
  }
  if (scanState === 'reconnecting') {
    return { text: 'Reconnecting to your bracelet…', showRetry: false, spinner: true };
  }
  if (scanState === 'error') {
    return { text: errorMessage ?? 'Something went wrong', showRetry: true, spinner: false };
  }
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' },
  status: {
    marginTop: 32,
    color: AMBER,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1,
    opacity: 0.55,
  },
  notice: {
    marginTop: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  noticeSpinner: {
    marginBottom: 10,
  },
  noticeText: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  retryText: {
    color: AMBER,
    fontSize: 14,
    fontWeight: '600',
  },
  relayNotice: {
    marginTop: 16,
    color: '#777777',
    fontSize: 12,
  },
});
