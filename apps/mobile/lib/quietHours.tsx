import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'everglow_quiet_hours';

// Quiet hours: a local wall-clock window during which the bracelet stays dark even
// when a partner beat arrives. Stored on-device (AsyncStorage) so the background
// wake handler can read it with no network or auth on the relay's critical path.
export interface QuietHours {
  enabled: boolean;
  startMinutes: number; // minutes since local midnight, inclusive
  endMinutes: number; // minutes since local midnight, exclusive
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  startMinutes: 22 * 60, // 22:00
  endMinutes: 7 * 60, // 07:00
};

// Bracelet brightness (0–255) used while quiet hours are active. The partner's beat
// still breathes as a faint glow rather than going fully dark (normal pulse is 200).
export const QUIET_HOURS_BRIGHTNESS = 30;

// Format minutes-since-midnight as 24h HH:MM (e.g. 1320 → "22:00").
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Step a minutes-since-midnight value by `delta`, wrapping around the 24h day.
export function stepMinutes(minutes: number, delta: number): number {
  return ((minutes + delta) % 1440 + 1440) % 1440;
}

// Pure check — is `date` inside the quiet-hours window? Handles overnight windows
// (e.g. 22:00 → 07:00) where the start is later in the day than the end.
export function isWithinQuietHours(config: QuietHours, date: Date = new Date()): boolean {
  if (!config.enabled) return false;
  const { startMinutes, endMinutes } = config;
  if (startMinutes === endMinutes) return false; // zero-length window = never active
  const cur = date.getHours() * 60 + date.getMinutes();
  if (startMinutes < endMinutes) {
    return cur >= startMinutes && cur < endMinutes;
  }
  return cur >= startMinutes || cur < endMinutes; // overnight wrap
}

function parse(raw: string | null): QuietHours {
  if (!raw) return DEFAULT_QUIET_HOURS;
  try {
    const v = JSON.parse(raw) as Partial<QuietHours>;
    return {
      enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_QUIET_HOURS.enabled,
      startMinutes:
        typeof v.startMinutes === 'number' ? v.startMinutes : DEFAULT_QUIET_HOURS.startMinutes,
      endMinutes:
        typeof v.endMinutes === 'number' ? v.endMinutes : DEFAULT_QUIET_HOURS.endMinutes,
    };
  } catch {
    return DEFAULT_QUIET_HOURS;
  }
}

// Direct AsyncStorage read for consumers without React context — specifically the
// background wake handler (lib/backgroundBeatRelay.ts). Falls back to defaults on error.
export async function loadQuietHours(): Promise<QuietHours> {
  try {
    return parse(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_QUIET_HOURS;
  }
}

interface QuietHoursContextValue {
  isLoading: boolean;
  quietHours: QuietHours;
  setQuietHours: (next: QuietHours) => Promise<void>;
}

const QuietHoursContext = createContext<QuietHoursContextValue | null>(null);

export function QuietHoursProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [quietHours, setQuietHoursState] = useState<QuietHours>(DEFAULT_QUIET_HOURS);

  useEffect(() => {
    loadQuietHours().then((qh) => {
      setQuietHoursState(qh);
      setIsLoading(false);
    });
  }, []);

  const setQuietHours = useCallback(async (next: QuietHours) => {
    setQuietHoursState(next); // optimistic — UI reflects the change immediately
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  return (
    <QuietHoursContext.Provider value={{ isLoading, quietHours, setQuietHours }}>
      {children}
    </QuietHoursContext.Provider>
  );
}

export function useQuietHours() {
  const ctx = useContext(QuietHoursContext);
  if (!ctx) throw new Error('useQuietHours must be used inside QuietHoursProvider');
  return ctx;
}
