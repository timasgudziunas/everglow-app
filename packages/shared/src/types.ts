// Beat event transmitted from bracelet → phone → backend → partner's phone → partner's bracelet.
// 8 bytes, little-endian: timestampMs (uint32) | intervalMs (uint16) | sequence (uint8) | checksum XOR (uint8).
// Matches GATT.BEAT_EVENT_CHARACTERISTIC byte layout — firmware and app must stay in sync.
export interface BeatEvent {
  timestampMs: number;
  intervalMs: number;
  sequence: number;
  checksum: number;
}

export type WearingState = 'both' | 'you_only' | 'partner_only' | 'neither';

export interface PartnerLink {
  id: string;
  userId: string;
  partnerId: string;
  linkedAt: string;
}
