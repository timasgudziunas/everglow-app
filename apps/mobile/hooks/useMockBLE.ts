import { useState, useCallback, useEffect, useRef } from 'react';
import { Device, State } from 'react-native-ble-plx';
import type { BeatEvent, LightCommand, ScanState, UseBLEReturn } from './useBLE';

const FAKE_DEVICES = [
  { id: 'mock-001', name: 'Everglow Bracelet', rssi: -52 },
  { id: 'mock-002', name: 'Everglow Bracelet (2)', rssi: -78 },
] as unknown as Device[];

// 65–73 BPM range with slight natural variation
function nextIntervalMs(): number {
  return 820 + Math.floor(Math.random() * 120);
}

export function useMockBLE(): UseBLEReturn {
  const [btState, setBtState] = useState<State>(State.Unknown);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [latestBeat, setLatestBeat] = useState<BeatEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scanTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const beatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Simulate BT stack initializing
    const t = setTimeout(() => setBtState(State.PoweredOn), 500);
    return () => {
      clearTimeout(t);
      scanTimersRef.current.forEach(clearTimeout);
      if (beatTimerRef.current) clearTimeout(beatTimerRef.current);
    };
  }, []);

  const startScan = useCallback(() => {
    setDevices([]);
    setErrorMessage(null);
    setScanState('scanning');

    // First device appears after 1.5s, second after 3s
    const t1 = setTimeout(() => setDevices([FAKE_DEVICES[0]]), 1500);
    const t2 = setTimeout(() => setDevices([FAKE_DEVICES[0], FAKE_DEVICES[1]]), 3000);
    scanTimersRef.current = [t1, t2];
  }, []);

  const stopScan = useCallback(() => {
    scanTimersRef.current.forEach(clearTimeout);
    scanTimersRef.current = [];
    setScanState('idle');
  }, []);

  const connectToDevice = useCallback(async (device: Device) => {
    scanTimersRef.current.forEach(clearTimeout);
    scanTimersRef.current = [];
    setScanState('connecting');
    setErrorMessage(null);

    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    if (beatTimerRef.current) clearTimeout(beatTimerRef.current);

    let sequence = 0;

    const scheduleBeat = () => {
      const intervalMs = nextIntervalMs();
      const timestampMs = Date.now() & 0xffffffff;
      const seq = sequence++ & 0xff;

      // Compute XOR checksum over first 7 bytes — mirrors firmware
      const bytes = new Uint8Array(7);
      const view = new DataView(bytes.buffer);
      view.setUint32(0, timestampMs, true);
      view.setUint16(4, intervalMs, true);
      view.setUint8(6, seq);
      const checksum = bytes.reduce((xor, b) => xor ^ b, 0);

      setLatestBeat({ timestampMs, intervalMs, sequence: seq, checksum });
      beatTimerRef.current = setTimeout(scheduleBeat, intervalMs);
    };

    scheduleBeat();
    setConnectedDevice(device);
    setScanState('connected');
  }, []);

  const sendLightCommand = useCallback(async (cmd: LightCommand) => {
    console.log('[MockBLE] sendLightCommand', cmd);
  }, []);

  return {
    btState,
    scanState,
    devices,
    connectedDevice,
    latestBeat,
    errorMessage,
    startScan,
    stopScan,
    connectToDevice,
    sendLightCommand,
  };
}
