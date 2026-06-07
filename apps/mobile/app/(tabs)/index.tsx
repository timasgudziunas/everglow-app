import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HeartbeatRing } from '../../components/HeartbeatRing';
import { useMockBLE } from '../../hooks/useMockBLE';
import { useRelay } from '../../hooks/useRelay';
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
  const { devices, scanState, connectedDevice, latestBeat, startScan, connectToDevice, sendLightCommand } = useMockBLE();
  const { latestPartnerBeat } = useRelay({ latestBeat, sendLightCommand });

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

  return (
    <View style={styles.container}>
      <HeartbeatRing beat={beatForRing} bpm={bpmForRing} wearingState={wearingState} />
      <Text style={styles.status}>{statusLabel(wearingState, connectedDevice?.name)}</Text>
    </View>
  );
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
});
