import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { MoreMenu } from '@/components/MoreMenu';
import { RefreshableScroll } from '@/components/RefreshableScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { repairStatusLabel, type Repair, type RepairStatus } from '@/lib/types';

export default function RepairDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { isAdmin } = useAuth();
  const [repair, setRepair] = useState<Repair | null>(null);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setRepair(await api.get<Repair>(`/api/repairs/${id}`));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const status = (repair && repair.status in repairStatusLabel ? repair.status : 'pending') as RepairStatus;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <RefreshableScroll onRefresh={load} contentContainerStyle={styles.content}>
        {error && !repair ? (
          <Text style={{ color: palette.danger }}>{error}</Text>
        ) : !repair ? (
          <ActivityIndicator color={palette.tint} style={{ marginTop: 24 }} />
        ) : (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: palette.text }]}>{repair.title}</Text>
              {isAdmin ? (
                <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityLabel="더보기">
                  <Text style={[styles.more, { color: palette.muted }]}>⋮</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.meta, { color: palette.tint }]}>{repairStatusLabel[status]}</Text>
            {repair.place ? <Text style={[styles.body, { color: palette.text }]}>의뢰인  {repair.place}</Text> : null}
            {repair.description ? <Text style={[styles.body, { color: palette.text }]}>{repair.description}</Text> : null}
            <Text style={[styles.body, { color: palette.muted }]}>{formatDateTime(repair.createdAt)}</Text>
          </View>
        )}
      </RefreshableScroll>
      {repair ? (
        <MoreMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          actions={[
            {
              label: '대기',
              onPress: async () => {
                try {
                  const updated = await api.patch<Repair>(`/api/repairs/${repair.id}`, { status: 'pending' });
                  setRepair(updated);
                } catch (caught) {
                  Alert.alert('상태를 바꾸지 못했습니다.', caught instanceof Error ? caught.message : '');
                }
              },
            },
            {
              label: '진행',
              onPress: async () => {
                try {
                  const updated = await api.patch<Repair>(`/api/repairs/${repair.id}`, { status: 'doing' });
                  setRepair(updated);
                } catch (caught) {
                  Alert.alert('상태를 바꾸지 못했습니다.', caught instanceof Error ? caught.message : '');
                }
              },
            },
            {
              label: '완료',
              onPress: async () => {
                try {
                  const updated = await api.patch<Repair>(`/api/repairs/${repair.id}`, { status: 'done' });
                  setRepair(updated);
                } catch (caught) {
                  Alert.alert('상태를 바꾸지 못했습니다.', caught instanceof Error ? caught.message : '');
                }
              },
            },
            {
              label: '삭제',
              danger: true,
              onPress: () =>
                Alert.alert('수리 요청을 삭제할까요?', repair.title, [
                  { text: '취소', style: 'cancel' },
                  {
                    text: '삭제',
                    style: 'destructive',
                    onPress: async () => {
                      await api.remove(`/api/repairs/${repair.id}`);
                      router.replace('/repairs');
                    },
                  },
                ]),
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 24, fontWeight: '700' },
  more: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  meta: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
});
