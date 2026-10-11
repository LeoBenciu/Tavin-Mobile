import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { store } from '@/api/store';
import { SessionProvider, useSession } from '@/auth/session';
import { LanguageProvider } from '@/i18n';
import { ThemePreferenceProvider, useColors, useIsDark, useThemePreference } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { status } = useSession();
  const { ready: themeReady } = useThemePreference();
  const c = useColors();
  const dark = useIsDark();

  useEffect(() => {
    if (status !== 'loading' && themeReady) SplashScreen.hideAsync().catch(() => undefined);
  }, [status, themeReady]);

  if (status === 'loading' || !themeReady) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.background,
      card: c.surface,
      text: c.text,
      border: c.line,
    },
  };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <ThemePreferenceProvider>
            <LanguageProvider>
              <SessionProvider>
                <RootNavigator />
              </SessionProvider>
            </LanguageProvider>
          </ThemePreferenceProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
