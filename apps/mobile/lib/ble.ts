import { BleManager } from 'react-native-ble-plx';

// Everglow custom GATT profile — v1.0, locked 2026-06-06.
// Firmware and app must use these exact UUIDs.
export const GATT = {
  SERVICE_UUID: 'F3640001-5F4E-4B39-9A2E-7D8E1F0A3C5B',

  // Notify characteristic — bracelet → phone, 8 bytes, little-endian.
  // [0–3] uint32 timestampMs  [4–5] uint16 intervalMs
  // [6]   uint8  sequence     [7]   uint8  checksum (XOR of bytes 0–6)
  BEAT_EVENT_CHARACTERISTIC: 'F3640002-5F4E-4B39-9A2E-7D8E1F0A3C5B',

  // Write-without-response characteristic — phone → bracelet, 4 bytes, little-endian.
  // [0] uint8 command (0x00 = off, 0x01 = pulse)
  // [1–2] uint16 durationMs   [3] uint8 brightness (0–255)
  LIGHT_COMMAND_CHARACTERISTIC: 'F3640003-5F4E-4B39-9A2E-7D8E1F0A3C5B',
} as const;

export const bleManager = new BleManager();
