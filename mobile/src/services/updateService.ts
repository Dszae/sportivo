import { Platform, Linking } from 'react-native';
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

export const CURRENT_VERSION = Constants.expoConfig?.version || '1.1.7';
export const CURRENT_VERSION_CODE = Constants.expoConfig?.android?.versionCode || 18;
const VERSION_CHECK_URL = 'https://sportivo.dipeshsapkota7.com.np/api/app-version.json';
export const UPDATE_APK_PATH = `${FileSystem.cacheDirectory}sportivo-update.apk`;

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
 * Triggers Android's package installer for a cached APK
 */
export async function installCachedApk(fileUri: string = UPDATE_APK_PATH): Promise<{ success: boolean; error?: string }> {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      return { success: false, error: 'Update file not found on device' };
    }

    const contentUri = await FileSystem.getContentUriAsync(fileUri);

    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1 | 268435456, // FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK
      type: 'application/vnd.android.package-archive',
    });

    return { success: true };
  } catch (err: any) {
    console.warn('Native installer notice:', err);
    return { success: false, error: err?.message || 'Installer launch notice' };
  }
}

/**
 * Downloads the APK directly inside the app in the background with percentage progress,
 * then triggers Android's native package installer immediately.
 * Zero browser involvement!
 */
export async function downloadAndInstallUpdate(
  apkUrl: string,
  onProgress?: (progressPercent: number) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const destination = UPDATE_APK_PATH;

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
    if (!result || !result.uri || (result.status && result.status !== 200)) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
      return {
        success: false,
        error: 'Update package is still being generated or server returned an error. Please try again in a moment.',
      };
    }

    // Verify APK file integrity (must be a valid binary > 5MB, not an HTML error page)
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    if (!fileInfo.exists || (fileInfo.size && fileInfo.size < 5 * 1024 * 1024)) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      return {
        success: false,
        error: 'Downloaded package was incomplete or invalid. Please retry.',
      };
    }

    onProgress?.(100);

    return await installCachedApk(result.uri);
  } catch (err: any) {
    console.error('Failed to download and install update in-app:', err);
    try {
      await Linking.openURL(apkUrl);
    } catch {}
    return { success: false, error: err?.message || 'Installation failed' };
  }
}
