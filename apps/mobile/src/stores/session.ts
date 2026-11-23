import { currencyForRegion, type Currency } from '@vela/api';
import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

export type LanguagePreference = 'system' | 'en' | 'ar';
export type SignInProvider = 'apple' | 'google' | 'phone';

type SessionState = {
  hydrated: boolean;
  onboardingSeen: boolean;
  signedIn: boolean;
  provider: SignInProvider | null;
  language: LanguagePreference;
  currency: Currency;
  notifications: boolean;
  faceIdForPurchases: boolean;
  completeOnboarding: (notifications: boolean) => void;
  signIn: (provider: SignInProvider) => void;
  signOut: () => void;
  setLanguage: (language: LanguagePreference) => void;
  setCurrency: (currency: Currency) => void;
  setNotifications: (value: boolean) => void;
  setFaceIdForPurchases: (value: boolean) => void;
  resetOnboarding: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboardingSeen: false,
      signedIn: false,
      provider: null,
      language: 'system',
      currency: currencyForRegion(getLocales()[0]?.regionCode),
      notifications: false,
      faceIdForPurchases: true,
      completeOnboarding: (notifications) => set({ onboardingSeen: true, notifications }),
      signIn: (provider) => set({ signedIn: true, provider }),
      signOut: () => set({ signedIn: false, provider: null }),
      setLanguage: (language) => set({ language }),
      setCurrency: (currency) => set({ currency }),
      setNotifications: (notifications) => set({ notifications }),
      setFaceIdForPurchases: (faceIdForPurchases) => set({ faceIdForPurchases }),
      resetOnboarding: () => set({ onboardingSeen: false, signedIn: false, provider: null }),
    }),
    {
      name: 'vela-session',
      storage: persistStorage,
      partialize: ({ hydrated: _hydrated, ...rest }) => rest,
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);
