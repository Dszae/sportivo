import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { UserPreferences } from '../types';
import { loadPreferences, savePreferences, DEFAULT_PREFERENCES } from '../services/storage';
import {
  requestNativeNotificationPermission,
  triggerGoalHaptic,
  triggerButtonHaptic,
} from '../services/notifications';

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 8;
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await loadPreferences();
      setPrefs(p);
      const perm = await requestNativeNotificationPermission();
      setHasPermission(perm);
    })();
  }, []);

  const updateNotifSetting = async (key: keyof UserPreferences['notifications'], value: boolean) => {
    await triggerButtonHaptic();
    const next: UserPreferences = {
      ...prefs,
      notifications: {
        ...prefs.notifications,
        [key]: value,
      },
    };
    setPrefs(next);
    await savePreferences(next);
  };

  const handleTestAlert = async () => {
    await triggerGoalHaptic();
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Kickoff in 5 Minutes!',
          body: 'Real Madrid 🆚 Barcelona. El Clásico kicks off at 8:45 PM NST. Get ready to watch live!',
          data: { matchTitle: 'Real Madrid vs Barcelona' },
          channelId: 'match-alerts',
        },
        trigger: null, // send immediately
      });
      Alert.alert('Alert Sent', 'Native notification fired with vibration.');
    } catch {
      Alert.alert('Notification Permission', 'Please ensure notifications are enabled in your phone Settings.');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPadding }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Banner */}
      <View style={styles.banner}>
        <Ionicons name="notifications-outline" size={32} color="#c9f36b" style={{ marginBottom: 8 }} />
        <Text style={styles.bannerTitle}>Match Alerts &amp; Notifications</Text>
        <Text style={styles.bannerSubtitle}>
          Receive instant alerts for teams in your Watchlist. Works even when the app is closed or phone is locked!
        </Text>
      </View>

      {/* Test Button */}
      <TouchableOpacity style={styles.testBtn} onPress={handleTestAlert}>
        <Ionicons name="notifications" size={16} color="#080a0b" style={{ marginRight: 6 }} />
        <Text style={styles.testBtnText}>Send Test Notification &amp; Vibration</Text>
      </TouchableOpacity>

      {/* Toggles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ALERT PREFERENCES</Text>

        <View style={styles.settingCard}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingTitle}>5-Minute Kickoff Alert</Text>
            <Text style={styles.settingDesc}>Notifies 5 minutes before kickoff with venue &amp; time</Text>
          </View>
          <Switch
            value={prefs.notifications.remind5Min}
            onValueChange={(val) => updateNotifSetting('remind5Min', val)}
            trackColor={{ false: '#334155', true: '#c9f36b' }}
            thumbColor={prefs.notifications.remind5Min ? '#080a0b' : '#94a3b8'}
          />
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingTitle}>30-Minute Kickoff Reminder</Text>
            <Text style={styles.settingDesc}>Matchday heads-up 30m before kickoff</Text>
          </View>
          <Switch
            value={prefs.notifications.remind30Min}
            onValueChange={(val) => updateNotifSetting('remind30Min', val)}
            trackColor={{ false: '#334155', true: '#c9f36b' }}
            thumbColor={prefs.notifications.remind30Min ? '#080a0b' : '#94a3b8'}
          />
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingTitle}>Live Goals &amp; Wickets</Text>
            <Text style={styles.settingDesc}>Instant score change alerts during live matches</Text>
          </View>
          <Switch
            value={prefs.notifications.notifyGoalsWickets}
            onValueChange={(val) => updateNotifSetting('notifyGoalsWickets', val)}
            trackColor={{ false: '#334155', true: '#c9f36b' }}
            thumbColor={prefs.notifications.notifyGoalsWickets ? '#080a0b' : '#94a3b8'}
          />
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingTextCol}>
            <Text style={styles.settingTitle}>Haptic Vibration</Text>
            <Text style={styles.settingDesc}>Buzz phone with tactile pulses when moment occurs</Text>
          </View>
          <Switch
            value={prefs.notifications.vibrationEnabled}
            onValueChange={(val) => updateNotifSetting('vibrationEnabled', val)}
            trackColor={{ false: '#334155', true: '#c9f36b' }}
            thumbColor={prefs.notifications.vibrationEnabled ? '#080a0b' : '#94a3b8'}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080a0b',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  banner: {
    backgroundColor: '#111a19',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 16,
  },
  bannerIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 18,
  },
  testBtn: {
    backgroundColor: '#c9f36b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#080a0b',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#e5b94f',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  settingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111a19',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  settingTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  settingDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 16,
  },
});

