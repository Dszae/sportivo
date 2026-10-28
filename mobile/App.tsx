import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import {
  setupNotificationChannels,
  requestNativeNotificationPermission,
  autoScheduleAllMatchAlerts,
} from './src/services/notifications';
import { fetchNplFixtures } from './src/services/api';
import { startLiveMomentPoller } from './src/services/matchMomentService';

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
      try {
        const npl = await fetchNplFixtures();
        if (npl && npl.length > 0) {
          await autoScheduleAllMatchAlerts(
            npl.map((f) => ({
              title: `${f.homeTeam} vs ${f.awayTeam}`,
              timestamp: f.timestamp,
            }))
          );
        }
      } catch (e) {
        console.warn('Auto schedule NPL alerts failed', e);
      }
    })();

    // Start background live moment poller (wickets, 4s, 6s, milestones)
    const stopPoller = startLiveMomentPoller(12000);
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
