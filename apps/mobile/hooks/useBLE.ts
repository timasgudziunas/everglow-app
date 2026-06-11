import { useState, useCallback, useEffect, useRef } from 'react';
import { Device, State, BleError, Subscription } from 'react-native-ble-plx';
import {
  bleManager,
  GATT,
  setConnectedDeviceId,
  sendLightCommandToBracelet,
  type LightCommand,
} from '../lib/ble';

export type ScanState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type WearingState = 'both' | 'you_only' | 'partner_only' | 'neither';

// Mirrors packages/shared BeatEvent — keep in sync with GATT.BEAT_EVENT_CHARACTERISTIC byte layout.
export type BeatEvent = {
  timestampMs: number;
  intervalMs: number;
  sequence: number;
  checksum: number;
};

// Re-exported from lib/ble (single source of truth) so existing imports of
// LightCommand from this module keep working.
export type { LightCommand };

export type UseBLEReturn = {
  btState: State;
  scanState: ScanState;
  devices: Device[];
  connectedDevice: Device | null;
  latestBeat: BeatEvent | null;
  errorMessage: string | null;
  startScan: () => void;
  stopScan: () => void;
  connectToDevice: (device: Device) => Promise<void>;
  sendLightCommand: (cmd: LightCommand) => Promise<void>;
};

// Stop scanning after this long with no connection — avoids a battery-draining scan
// that runs forever when no bracelet is in range.
const SCAN_TIMEOUT_MS = 15_000;
// On an unexpected disconnect, retry with exponential backoff up to this many times.
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 16_000;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseBeatEvent(base64: string): BeatEvent | null {
  const bytes = base64ToBytes(base64);
  if (bytes.length < 8) return null;
  const computed = bytes.slice(0, 7).reduce((xor, b) => xor ^ b, 0);
  if (computed !== bytes[7]) return null; // discard on checksum mismatch
  const view = new DataView(bytes.buffer);
  return {
    timestampMs: view.getUint32(0, true),
    intervalMs: view.getUint16(4, true),
    sequence: view.getUint8(6),
    checksum: view.getUint8(7),
  };
}

export function useBLE(): UseBLEReturn {
  const [btState, setBtState] = useState<State>(State.Unknown);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [latestBeat, setLatestBeat] = useState<BeatEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const btStateRef = useRef<State>(State.Unknown);
  const isScanningRef = useRef(false);
  const foundAnyRef = useRef(false);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beatSubRef = useRef<Subscription | null>(null);
  const disconnectSubRef = useRef<Subscription | null>(null);
  const connectedDeviceRef = useRef<Device | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set before any disconnect we trigger ourselves (unmount, BT off) so the
  // disconnect handler knows not to kick off a reconnection.
  const intentionalRef = useRef(false);

  const clearScanTimeout = useCallback(() => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // Drop the beat monitor + disconnect watcher and clear connected state.
  const teardownConnection = useCallback(() => {
    beatSubRef.current?.remove();
    beatSubRef.current = null;
    disconnectSubRef.current?.remove();
    disconnectSubRef.current = null;
    setConnectedDeviceId(null);
    setConnectedDevice(null);
    setLatestBeat(null);
  }, []);

  // Discover services, subscribe to beats, and watch for disconnects on `device`.
  // Used for both the initial connect and each reconnect attempt.
  const attach = useCallback(async (device: Device) => {
    await device.discoverAllServicesAndCharacteristics();

    beatSubRef.current?.remove();
    beatSubRef.current = device.monitorCharacteristicForService(
      GATT.SERVICE_UUID,
      GATT.BEAT_EVENT_CHARACTERISTIC,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const beat = parseBeatEvent(characteristic.value);
        if (beat) setLatestBeat(beat);
      }
    );

    disconnectSubRef.current?.remove();
    disconnectSubRef.current = device.onDisconnected(() => handleDisconnect());

    connectedDeviceRef.current = device;
    // Publish the device id to module scope so the background wake handler can
    // reach this bracelet without going through React.
    setConnectedDeviceId(device.id);
    setConnectedDevice(device);
    reconnectAttemptsRef.current = 0;
    setErrorMessage(null);
    setScanState('connected');
  }, []);

  // Schedule the next reconnect attempt with exponential backoff. Gives up (→ error)
  // after MAX_RECONNECT_ATTEMPTS.
  const scheduleReconnect = useCallback(() => {
    const device = connectedDeviceRef.current;
    if (!device) return;

    const attempt = reconnectAttemptsRef.current + 1;
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      setScanState('error');
      setErrorMessage('Could not reconnect to your bracelet');
      return;
    }
    reconnectAttemptsRef.current = attempt;
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1), RECONNECT_MAX_DELAY_MS);

    clearReconnectTimer();
    reconnectTimerRef.current = setTimeout(async () => {
      if (btStateRef.current !== State.PoweredOn) {
        setScanState('error');
        setErrorMessage('Bluetooth is off');
        return;
      }
      try {
        const reconnected = await bleManager.connectToDevice(device.id);
        await attach(reconnected);
      } catch {
        scheduleReconnect(); // back off and try again
      }
    }, delay);
  }, [attach, clearReconnectTimer]);

  // An unexpected drop: clean up and start backoff reconnection — unless we caused
  // it ourselves or Bluetooth is off (no point retrying until it returns).
  const handleDisconnect = useCallback(() => {
    beatSubRef.current?.remove();
    beatSubRef.current = null;
    setConnectedDeviceId(null);
    setConnectedDevice(null);
    setLatestBeat(null);

    if (intentionalRef.current) return;
    if (btStateRef.current !== State.PoweredOn) {
      setScanState('error');
      setErrorMessage('Bluetooth is off');
      return;
    }
    if (!connectedDeviceRef.current) {
      setScanState('error');
      setErrorMessage('Bracelet disconnected');
      return;
    }
    setScanState('reconnecting');
    scheduleReconnect();
  }, [scheduleReconnect]);

  // Track Bluetooth power state. If it goes off while connected, tear down and
  // surface it rather than silently failing reconnects.
  useEffect(() => {
    const sub = bleManager.onStateChange((state) => {
      setBtState(state);
      btStateRef.current = state;
      if (state !== State.PoweredOn && connectedDeviceRef.current) {
        clearReconnectTimer();
        teardownConnection();
        setScanState('error');
        setErrorMessage(state === State.PoweredOff ? 'Bluetooth is off' : 'Bluetooth unavailable');
      }
    }, true);
    return () => sub.remove();
  }, [clearReconnectTimer, teardownConnection]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      intentionalRef.current = true;
      clearScanTimeout();
      clearReconnectTimer();
      beatSubRef.current?.remove();
      disconnectSubRef.current?.remove();
      if (isScanningRef.current) bleManager.stopDeviceScan();
    };
  }, [clearScanTimeout, clearReconnectTimer]);

  const startScan = useCallback(() => {
    intentionalRef.current = false;
    clearReconnectTimer();
    reconnectAttemptsRef.current = 0;
    setDevices([]);
    setErrorMessage(null);
    setScanState('scanning');
    isScanningRef.current = true;
    foundAnyRef.current = false;

    clearScanTimeout();
    scanTimeoutRef.current = setTimeout(() => {
      if (!isScanningRef.current) return;
      bleManager.stopDeviceScan();
      isScanningRef.current = false;
      if (foundAnyRef.current) {
        setScanState('idle'); // devices were listed; let the user pick one
      } else {
        setErrorMessage('No bracelet found nearby');
        setScanState('error');
      }
    }, SCAN_TIMEOUT_MS);

    bleManager.startDeviceScan(
      [GATT.SERVICE_UUID],
      { allowDuplicates: false },
      (error: BleError | null, device: Device | null) => {
        if (error) {
          clearScanTimeout();
          isScanningRef.current = false;
          setErrorMessage(error.message);
          setScanState('error');
          return;
        }
        if (device) {
          foundAnyRef.current = true;
          setDevices((prev) => (prev.some((d) => d.id === device.id) ? prev : [...prev, device]));
        }
      }
    );
  }, [clearScanTimeout, clearReconnectTimer]);

  const stopScan = useCallback(() => {
    clearScanTimeout();
    bleManager.stopDeviceScan();
    isScanningRef.current = false;
    setScanState('idle');
  }, [clearScanTimeout]);

  const connectToDevice = useCallback(
    async (device: Device) => {
      clearScanTimeout();
      bleManager.stopDeviceScan();
      isScanningRef.current = false;
      intentionalRef.current = false;
      reconnectAttemptsRef.current = 0;
      setScanState('connecting');
      setErrorMessage(null);
      try {
        const connected = await device.connect();
        await attach(connected);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        setErrorMessage(message);
        setScanState('error');
      }
    },
    [attach, clearScanTimeout]
  );

  const sendLightCommand = useCallback(
    (cmd: LightCommand) => sendLightCommandToBracelet(cmd),
    []
  );

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
