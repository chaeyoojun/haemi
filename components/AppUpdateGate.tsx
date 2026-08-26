import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import {
  currentVersionCode,
  downloadAndInstallRelease,
  fetchAppRelease,
  type AppRelease,
} from '@/lib/appUpdate';

export function AppUpdateGate({ children }: { children: React.ReactNode }) {
  const palette = Colors[useColorScheme()];
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAppRelease()
      .then((next) => {
        if (next.versionCode > currentVersionCode()) {
          setRelease(next);
        }
      })
      .catch(() => undefined);
  }, []);

  const onUpdate = async () => {
    if (!release) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await downloadAndInstallRelease(release, setProgress);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '업데이트를 설치하지 못했습니다.');
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {children}
      <Modal visible={Boolean(release)} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.title, { color: palette.text }]}>새 버전이 있습니다</Text>
            <Text style={[styles.body, { color: palette.muted }]}>
              {release?.notes || '앱을 최신 버전으로 업데이트해 주세요.'}
            </Text>
            <Text style={[styles.meta, { color: palette.tint }]}>{release?.version}</Text>
            {busy ? (
              <View style={styles.progressRow}>
                <ActivityIndicator color={palette.tint} />
                <Text style={[styles.body, { color: palette.text }]}>
                  받는 중 {Math.round(progress * 100)}%
                </Text>
              </View>
            ) : null}
            {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
            <Pressable
              onPress={onUpdate}
              disabled={busy}
              style={[styles.primary, { backgroundColor: palette.tint, opacity: busy ? 0.7 : 1 }]}>
              <Text style={styles.primaryText}>{busy ? '업데이트 중...' : '업데이트'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22 },
  meta: { fontSize: 14, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primary: { marginTop: 8, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
