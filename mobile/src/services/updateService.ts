import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

export interface AppVersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt?: string;
  hasUpdate: boolean;
}

export const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.2';
export const CURRENT_VERSION_CODE = Constants.expoConfig?.android?.versionCode || 3;
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

/**
 * Downloads the APK directly inside the app with real-time percentage progress,
 * then triggers Android's native package installer immediately.
 * Zero browser involvement!
 */
export async function downloadAndInstallUpdate(
  apkUrl: string,
  onProgress?: (progressPercent: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const destination = `${FileSystem.cacheDirectory}sportivo-update.apk`;

    // Remove old downloaded update if present
    const existing = await FileSystem.getInfoAsync(destination);
    if (existing.exists) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
    }

    // Stream download directly inside the app with percentage tracking
    const downloadResumable = FileSystem.createDownloadResumable(
      apkUrl,
      destination,
      {},
      (downloadProgress) => {
        if (downloadProgress.totalBytesExpectedToWrite > 0) {
          const progress = Math.min(
            100,
            Math.round(
              (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
            )
          );
          onProgress?.(progress);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      return { success: false, error: 'Download failed' };
    }

    onProgress?.(100);

    // Convert file path to secure Android content URI
    const contentUri = await FileSystem.getContentUriAsync(result.uri);

    // Launch Android Package Installer activity
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });

    return { success: true };
  } catch (err: any) {
    console.error('Failed to download and install update in-app:', err);
    return { success: false, error: err?.message || 'Installation failed' };
  }
}
