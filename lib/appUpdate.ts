import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

import { API_URL, api, fileUrl } from '@/lib/api';

export type AppRelease = {
  version: string;
  versionCode: number;
  notes: string;
  apkUrl: string;
};

export function currentVersionCode() {
  const native = Number(Constants.nativeBuildVersion);
  if (Number.isFinite(native) && native > 0) {
    return native;
  }
  return Number(Constants.expoConfig?.android?.versionCode || 0);
}

export async function fetchAppRelease() {
  return api.get<AppRelease>('/api/app/version');
}

export async function downloadAndInstallRelease(
  release: AppRelease,
  onProgress?: (ratio: number) => void
) {
  if (Platform.OS !== 'android') {
    throw new Error('안드로이드에서만 앱 업데이트를 설치할 수 있습니다.');
  }
  if (!FileSystem.cacheDirectory) {
    throw new Error('파일을 저장할 수 없습니다.');
  }

  const dest = `${FileSystem.cacheDirectory}hmfpv-update.apk`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }

  const task = FileSystem.createDownloadResumable(
    fileUrl(release.apkUrl || '/api/app/hmfpv.apk'),
    dest,
    {},
    (progress) => {
      if (!onProgress || progress.totalBytesExpectedToWrite <= 0) {
        return;
      }
      onProgress(progress.totalBytesWritten / progress.totalBytesExpectedToWrite);
    }
  );

  const result = await task.downloadAsync();
  if (!result?.uri) {
    throw new Error('업데이트 파일을 받지 못했습니다.');
  }

  const contentUri = await FileSystem.getContentUriAsync(result.uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1,
    type: 'application/vnd.android.package-archive',
  });
}

export function apkDownloadUrl() {
  return `${API_URL}/api/app/hmfpv.apk`;
}
