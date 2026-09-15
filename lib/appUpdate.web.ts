import { API_URL, api } from '@/lib/api';

export type AppRelease = {
  version: string;
  versionCode: number;
  notes: string;
  apkUrl: string;
  ipaUrl?: string;
  iosInstallUrl?: string;
  hasApk?: boolean;
  hasIpa?: boolean;
};

export function currentVersionCode() {
  return Number.MAX_SAFE_INTEGER;
}

export async function fetchAppRelease() {
  return api.get<AppRelease>('/api/app/version');
}

export async function downloadAndInstallRelease() {}

export function apkDownloadUrl() {
  return `${API_URL}/api/app/hmfpv.apk`;
}

export function appDownloadPageUrl() {
  return `${API_URL}/app`;
}
