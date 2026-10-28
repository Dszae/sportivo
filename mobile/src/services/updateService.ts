import { Linking } from 'react-native';
import Constants from 'expo-constants';

export interface AppVersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt?: string;
  hasUpdate: boolean;
}

export const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.0';
export const CURRENT_VERSION_CODE = Constants.expoConfig?.android?.versionCode || 1;
const VERSION_CHECK_URL = 'https://sportivo.dipeshsapkota7.com.np/api/app-version.json';

export async function checkForAppUpdate(): Promise<AppVersionInfo | null> {
  try {
    const res = await fetch(`${VERSION_CHECK_URL}?_t=${Date.now()}`);
    if (!res.ok) return null;
    const remote = await res.json();

    const remoteCode = Number(remote.versionCode) || 1;
    const hasUpdate = remoteCode > CURRENT_VERSION_CODE || (remote.version && remote.version !== CURRENT_VERSION);

    return {
      version: remote.version,
      versionCode: remoteCode,
      downloadUrl: remote.downloadUrl,
      releaseNotes: remote.releaseNotes,
      publishedAt: remote.publishedAt,
      hasUpdate,
    };
  } catch (err) {
    console.warn('Failed to check for app update:', err);
    return null;
  }
}

export async function openAppUpdate(url: string) {
  try {
    await Linking.openURL(url);
  } catch (err) {
    console.warn('Failed to open update url:', err);
  }
}

