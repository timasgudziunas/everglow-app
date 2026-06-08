import { useState, useCallback, useEffect, useRef } from 'react';
import { Device, State, BleError, Subscription } from 'react-native-ble-plx';
import {
  bleManager,
  GATT,
  setConnectedDeviceId,
  sendLightCommandToBracelet,
  type LightCommand,
} from '../lib/ble';

export type ScanState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

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
  const isScanningRef = useRef(false);
  const beatSubscriptionRef = useRef<Subscription | null>(null);
  const connectedDeviceRef = useRef<Device | null>(null);

  useEffect(() => {
    const stateSubscription = bleManager.onStateChange((state) => {
      setBtState(state);
    }, true);
    return () => {
      stateSubscription.remove();
      beatSubscriptionRef.current?.remove();
      if (isScanningRef.current) bleManager.stopDeviceScan();
    };
  }, []);

  const startScan = useCallback(() => {
    setDevices([]);
    setErrorMessage(null);
    setScanState('scanning');
    isScanningRef.current = true;

    bleManager.startDeviceScan(
      [GATT.SERVICE_UUID],
      { allowDuplicates: false },
      (error: BleError | null, device: Device | null) => {
        if (error) {
          setErrorMessage(error.message);
          setScanState('error');
          isScanningRef.current = false;
          return;
        }
        if (device) {
          setDevices((prev) => {
            if (prev.some((d) => d.id === device.id)) return prev;
            return [...prev, device];
          });
        }
      }
    );
  }, []);

  const stopScan = useCallback(() => {
    bleManager.stopDeviceScan();
    isScanningRef.current = false;
    setScanState('idle');
  }, []);

  const connectToDevice = useCallback(async (device: Device) => {
    bleManager.stopDeviceScan();
    isScanningRef.current = false;
    setScanState('connecting');
    setErrorMessage(null);
    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();

      beatSubscriptionRef.current?.remove();
      beatSubscriptionRef.current = connected.monitorCharacteristicForService(
        GATT.SERVICE_UUID,
        GATT.BEAT_EVENT_CHARACTERISTIC,
        (error, characteristic) => {
          if (error || !characteristic?.value) return;
          const beat = parseBeatEvent(characteristic.value);
          if (beat) setLatestBeat(beat);
        }
      );

      connectedDeviceRef.current = connected;
      // Publish the device id to module scope so the background wake handler can
      // reach this bracelet without going through React.
      setConnectedDeviceId(connected.id);
      setConnectedDevice(connected);
      setScanState('connected');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setErrorMessage(message);
      setScanState('error');
    }
  }, []);

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
