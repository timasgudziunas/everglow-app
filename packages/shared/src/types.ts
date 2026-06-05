// Beat event transmitted from bracelet → phone → backend → partner's phone → partner's bracelet.
// ~8 bytes on the wire: timestamp (4B) + beat interval ms (2B) + sequence (1B) + checksum (1B).
// Layout must match firmware. TODO: finalize with firmware engineer before Phase 2.
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
