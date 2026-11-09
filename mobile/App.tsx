import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from '@expo-google-fonts/manrope';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import RootNavigator from './src/navigation/RootNavigator';
import {
  setupNotificationChannels,
  requestNativeNotificationPermission,
} from './src/services/notifications';
import { startGroundScorePoller } from './src/services/scoreService';
import { colors } from './src/theme';

const SportivoDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.ink900,
    card: colors.ink950,
    text: colors.fg,
    border: colors.line,
    primary: colors.lime,
    notification: colors.live,
  },
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    // Unconditionally hide splash screen immediately on mount so the app opens instantly
    SplashScreen.hideAsync().catch(() => {});

    // Initialize notification channels safely in background
    (async () => {
      try {
        await setupNotificationChannels();
        await requestNativeNotificationPermission();
        await Notifications.cancelAllScheduledNotificationsAsync();
      } catch (err) {
        console.warn('[App] Notification initialization notice:', err);
      }
    })();

    // Start real-time ground scorer poller safely
    let stopPoller: (() => void) | null = null;
    try {
      stopPoller = startGroundScorePoller();
    } catch (err) {
      console.warn('[App] Scorer poller notice:', err);
    }

    return () => {
      if (stopPoller) stopPoller();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={SportivoDarkTheme}>
        <StatusBar style="light" backgroundColor="#080a0b" translucent />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
