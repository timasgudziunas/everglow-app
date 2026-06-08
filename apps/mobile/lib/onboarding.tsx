import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_LAUNCH_KEY = 'everglow_first_launch_seen';
const ONBOARDING_COMPLETE_KEY = 'everglow_onboarding_complete';

interface OnboardingContextValue {
  isLoading: boolean;
  firstLaunchSeen: boolean;
  onboardingComplete: boolean;
  markFirstLaunchSeen: () => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [firstLaunchSeen, setFirstLaunchSeen] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    async function load() {
      const [seen, complete] = await Promise.all([
        AsyncStorage.getItem(FIRST_LAUNCH_KEY),
        AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY),
      ]);
      setFirstLaunchSeen(seen === 'true');
      setOnboardingComplete(complete === 'true');
      setIsLoading(false);
    }
    load();
  }, []);

  const markFirstLaunchSeen = useCallback(async () => {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    setFirstLaunchSeen(true);
  }, []);

  const markOnboardingComplete = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setOnboardingComplete(true);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{ isLoading, firstLaunchSeen, onboardingComplete, markFirstLaunchSeen, markOnboardingComplete }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
