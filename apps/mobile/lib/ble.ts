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

// Light command sent phone → bracelet. Mirrors the LIGHT_COMMAND_CHARACTERISTIC
// byte layout documented above. Kept here, next to the GATT profile, so both the
// useBLE hook and the background notification task share one serializer.
export type LightCommand = {
  command: 0x00 | 0x01; // 0x00 = off, 0x01 = pulse
  durationMs: number;
  brightness: number; // 0–255
};

export function encodeLightCommand(cmd: LightCommand): string {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, cmd.command);
  view.setUint16(1, cmd.durationMs, true);
  view.setUint8(3, cmd.brightness);
  return btoa(String.fromCharCode(...bytes));
}

// Id of the bracelet we're currently connected to, tracked at module scope so the
// background wake handler — which runs outside React and has no hook state — can
// still address the device through the BleManager singleton.
let connectedDeviceId: string | null = null;

export function setConnectedDeviceId(id: string | null): void {
  connectedDeviceId = id;
}

// Send a light command using only the BleManager singleton + the stored device id.
// Safe to call from the background notification task; no-ops if no bracelet is
// connected. Under the bluetooth-central background mode the BLE link stays alive
// even while the app is suspended, so this write still reaches the bracelet.
export async function sendLightCommandToBracelet(cmd: LightCommand): Promise<void> {
  if (!connectedDeviceId) return;
  await bleManager.writeCharacteristicWithoutResponseForDevice(
    connectedDeviceId,
    GATT.SERVICE_UUID,
    GATT.LIGHT_COMMAND_CHARACTERISTIC,
    encodeLightCommand(cmd)
  );
}
