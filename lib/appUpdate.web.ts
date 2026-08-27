export type AppRelease = {
  version: string;
  versionCode: number;
  notes: string;
  apkUrl: string;
  ipaUrl?: string;
  iosInstallUrl?: string;
  hasIpa?: boolean;
};

export function currentVersionCode() {
  return Number.MAX_SAFE_INTEGER;
}

export async function fetchAppRelease(): Promise<AppRelease> {
  return {
    version: 'web',
    versionCode: 0,
    notes: '',
    apkUrl: '',
  };
}

export async function downloadAndInstallRelease() {}
