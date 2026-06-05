import { BleManager } from 'react-native-ble-plx';

// Shared GATT UUIDs — must match firmware before connecting real hardware.
// TODO: finalize with firmware engineer before Phase 2.
export const GATT = {
  SERVICE_UUID: 'TODO',
  BEAT_EVENT_CHARACTERISTIC: 'TODO',
  LIGHT_COMMAND_CHARACTERISTIC: 'TODO',
} as const;

export const bleManager = new BleManager();
