import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { storage, StorageKeys } from '@/lib/storage';

/** Light, dark, or follow the phone (iOS Settings › Display & Brightness). */
export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** False until the saved choice has been read, so the app doesn't flash the wrong theme. */
  ready: boolean;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue>({
  preference: 'system',
  setPreference: () => {},
  ready: true,
});

/**
 * Also tells the OS, so native pieces (keyboard, alerts, pickers, the status bar)
 * match the app. react-native-web has no setColorScheme; there the context alone
 * drives the colours.
 */
function applyToNative(p: ThemePreference) {
  if (typeof Appearance.setColorScheme === 'function') {
    Appearance.setColorScheme(p === 'system' ? 'unspecified' : p);
  }
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.get(StorageKeys.theme).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        applyToNative(saved);
        setPreferenceState(saved);
      }
      setReady(true);
    });
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    applyToNative(p);
    setPreferenceState(p);
    void storage.set(StorageKeys.theme, p);
  }, []);

  const value = useMemo(() => ({ preference, setPreference, ready }), [preference, setPreference, ready]);
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference(): ThemePreferenceValue {
  return useContext(ThemePreferenceContext);
}
