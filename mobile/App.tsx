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

SplashScreen.preventAutoHideAsync().catch(() => {});

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
    (async () => {
      await setupNotificationChannels();
      await requestNativeNotificationPermission();
      // Purge all legacy / phantom scheduled notifications completely
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
      } catch {}
    })();

    // Start real-time ground scorer poller (3.5s ball-by-ball 4s, 6s, wickets, wides, no-balls)
    const stopPoller = startGroundScorePoller();
    return () => {
      stopPoller();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // Render with system fonts if loading fails rather than blocking the app.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={SportivoDarkTheme}>
        <StatusBar style="light" backgroundColor="transparent" translucent />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
