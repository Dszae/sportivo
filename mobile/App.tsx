import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import RootNavigator from './src/navigation/RootNavigator';
import {
  setupNotificationChannels,
  requestNativeNotificationPermission,
} from './src/services/notifications';
import { startGroundScorePoller } from './src/services/scoreService';

const SportivoDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#080a0b',
    card: '#0c1211',
    text: '#ffffff',
    border: 'rgba(255,255,255,0.08)',
    primary: '#c9f36b',
  },
};

export default function App() {
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

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={SportivoDarkTheme}>
        <StatusBar style="light" backgroundColor="#080a0b" translucent={false} />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
