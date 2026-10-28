import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import {
  setupNotificationChannels,
  requestNativeNotificationPermission,
} from './src/services/notifications';

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
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={SportivoDarkTheme}>
        <StatusBar style="light" backgroundColor="#080a0b" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

