import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowBackIcon, LocationIcon, ClockIcon, GlobeIcon, ChevronForwardIcon, GithubIcon, LinkedinIcon, MailIcon } from '../components/Icons';
import { checkForAppUpdate, openAppUpdate, CURRENT_VERSION } from '../services/updateService';

export default function AboutScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 12;
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus('Checking for latest updates...');
    const info = await checkForAppUpdate();
    setCheckingUpdate(false);
    if (!info) {
      setUpdateStatus('Could not reach update server. Check your connection.');
    } else if (info.hasUpdate) {
      setUpdateStatus(`Version v${info.version} ready! Launching update...`);
      openAppUpdate(info.downloadUrl);
    } else {
      setUpdateStatus(`You are using the latest version (v${CURRENT_VERSION})!`);
    }
  };

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.warn('Cannot open url:', url);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="light-content" backgroundColor="#080a0b" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <ArrowBackIcon size={20} color="#c9f36b" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About the Creator</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Image
            source={require('../../assets/dipesh-sapkota-profile.webp')}
            style={styles.avatar}
          />
          <Text style={styles.name}>Dipesh Sapkota</Text>
          <Text style={styles.role}>Creator &amp; Publisher · Sportivo</Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <LocationIcon size={13} color="#c9f36b" />
              <Text style={styles.badgeText}>Kathmandu, Nepal</Text>
            </View>
            <View style={styles.badge}>
              <ClockIcon size={13} color="#fbbf24" />
              <Text style={styles.badgeText}>NST · UTC+5:45</Text>
            </View>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Engineering &amp; Mission</Text>
          <Text style={styles.bioParagraph}>
            Dipesh Sapkota is an engineering student and software developer from Nepal. He designed and engineered Sportivo to provide sports enthusiasts across Nepal with unified, accurate kickoff schedules in Nepal Standard Time (NST / UTC+5:45), real-time scoreboards, and resilient multi-server streaming fallbacks.
          </Text>
          <Text style={styles.bioParagraph}>
            Sportivo aggregates live feeds across Football (Premier League, Champions League, La Liga, Serie A), Cricket (Nepal Premier League 2026, ICC Tournaments, IPL), and Basketball into an uncluttered, high-performance interface.
          </Text>
        </View>

        {/* Contact & Social Links */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Connect with Dipesh</Text>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => openLink('https://www.dipeshsapkota7.com.np/')}
          >
            <View style={styles.linkIconBox}>
              <GlobeIcon size={18} color="#c9f36b" />
            </View>
            <View style={styles.linkTextBox}>
              <Text style={styles.linkLabel}>Personal Website &amp; Portfolio</Text>
              <Text style={styles.linkValue}>www.dipeshsapkota7.com.np</Text>
            </View>
            <ChevronForwardIcon size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => openLink('https://github.com/Dszae')}
          >
            <View style={styles.linkIconBox}>
              <GithubIcon size={18} color="#c9f36b" />
            </View>
            <View style={styles.linkTextBox}>
              <Text style={styles.linkLabel}>GitHub</Text>
              <Text style={styles.linkValue}>github.com/Dszae</Text>
            </View>
            <ChevronForwardIcon size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => openLink('https://linkedin.com/in/dszae')}
          >
            <View style={styles.linkIconBox}>
              <LinkedinIcon size={18} color="#c9f36b" />
            </View>
            <View style={styles.linkTextBox}>
              <Text style={styles.linkLabel}>LinkedIn</Text>
              <Text style={styles.linkValue}>linkedin.com/in/dszae</Text>
            </View>
            <ChevronForwardIcon size={16} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => openLink('mailto:dsz.ae18@gmail.com')}
          >
            <View style={styles.linkIconBox}>
              <MailIcon size={18} color="#c9f36b" />
            </View>
            <View style={styles.linkTextBox}>
              <Text style={styles.linkLabel}>Direct Email</Text>
              <Text style={styles.linkValue}>dsz.ae18@gmail.com</Text>
            </View>
            <ChevronForwardIcon size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Direct In-App Updater Section */}
        <View style={styles.updateCheckSection}>
          <Text style={styles.updateCheckTitle}>App Updates</Text>
          <Text style={styles.updateCheckSubtitle}>
            Sportivo checks for verified updates directly without needing to open the browser.
          </Text>
          <TouchableOpacity
            style={styles.updateCheckBtn}
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
            activeOpacity={0.8}
          >
            {checkingUpdate ? (
              <ActivityIndicator size="small" color="#080a0b" />
            ) : (
              <Text style={styles.updateCheckBtnText}>Check for Updates Now</Text>
            )}
          </TouchableOpacity>
          {updateStatus ? (
            <Text style={styles.updateStatusText}>{updateStatus}</Text>
          ) : null}
        </View>

        {/* Legal & App Version Info */}
        <View style={styles.footerBox}>
          <Text style={styles.versionText}>Sportivo Mobile · Native Android Edition v1.0.0</Text>
          <Text style={styles.copyrightText}>© 2026 Dipesh Sapkota. All rights reserved.</Text>
          <TouchableOpacity
            style={styles.privacyBtn}
            onPress={() => openLink('https://sportivo.dipeshsapkota7.com.np/privacy/')}
          >
            <Text style={styles.privacyText}>View Privacy Policy &amp; Terms &rarr;</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080a0b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(201, 243, 107, 0.1)',
  },
  backText: {
    color: '#c9f36b',
    fontSize: 12,
    fontWeight: '800',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#0e1716',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    marginBottom: 16,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#c9f36b',
    marginBottom: 14,
  },
  name: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  role: {
    color: '#c9f36b',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#0e1716',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  bioParagraph: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  linkIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(201, 243, 107, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkTextBox: {
    flex: 1,
  },
  linkLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  linkValue: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  updateCheckSection: {
    backgroundColor: '#0c1413',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(201, 243, 107, 0.2)',
  },
  updateCheckTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  updateCheckSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  updateCheckBtn: {
    backgroundColor: '#c9f36b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateCheckBtnText: {
    color: '#080a0b',
    fontSize: 12,
    fontWeight: '900',
  },
  updateStatusText: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  footerBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  copyrightText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  privacyBtn: {
    marginTop: 8,
  },
  privacyText: {
    color: '#c9f36b',
    fontSize: 11,
    fontWeight: '800',
  },
});

