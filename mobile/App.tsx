import React, { useEffect, Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';
import {
  setupNotificationChannels,
  requestNativeNotificationPermission,
} from './src/services/notifications';
import { startGroundScorePoller } from './src/services/scoreService';
import { colors } from './src/theme';

// Ensure splash screen is hidden immediately even before first render tick
try {
  SplashScreen.hideAsync().catch(() => {});
} catch {}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.warn('[AppErrorBoundary] Unhandled error:', error, errorInfo);
    try {
      SplashScreen.hideAsync().catch(() => {});
    } catch {}
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.icon}>⚡</Text>
          <Text style={errorStyles.title}>Sportivo Encountered a Notice</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'The application recovered from an unexpected state.'}
          </Text>
          <TouchableOpacity style={errorStyles.button} onPress={this.handleReload} activeOpacity={0.8}>
            <Text style={errorStyles.buttonText}>Restart Sportivo</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e0d',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#edf0ee',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#a4aca8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#c9f36b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#0f130c',
    fontSize: 15,
    fontWeight: '700',
  },
});

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
      <AppErrorBoundary>
        <NavigationContainer theme={SportivoDarkTheme}>
          <StatusBar style="light" backgroundColor="transparent" translucent />
          <RootNavigator />
        </NavigationContainer>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
