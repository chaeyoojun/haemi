import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { InlineMoreActions } from '@/components/InlineMoreActions';
import { RefreshableScroll } from '@/components/RefreshableScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatAuthorTime } from '@/lib/format';
import { confirmAction, showNotice } from '@/lib/notice';
import { repairStatusLabel, type Repair, type RepairStatus } from '@/lib/types';

export default function RepairDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { isAdmin } = useAuth();
  const [repair, setRepair] = useState<Repair | null>(null);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');

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

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const setStatus = async (next: RepairStatus) => {
    if (!repair) {
      return;
    }
    if (repair.status === next) {
      setNotice(`이미 ${repairStatusLabel[next]} 상태입니다.`);
      return;
    }
    try {
      setRepair(await api.patch<Repair>(`/api/repairs/${repair.id}`, { status: next }));
      setNotice(`수리 상태를 ${repairStatusLabel[next]}(으)로 바꿨습니다.`);
    } catch (caught) {
      showNotice('상태를 바꾸지 못했습니다.', caught instanceof Error ? caught.message : '');
    }
  };

  const status = (repair && repair.status in repairStatusLabel ? repair.status : 'pending') as RepairStatus;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <RefreshableScroll onRefresh={load} contentContainerStyle={styles.content}>
        {error && !repair ? (
          <Text style={{ color: palette.danger }}>{error}</Text>
        ) : !repair ? (
          <ActivityIndicator color={palette.tint} style={{ marginTop: 24 }} />
        ) : (
          <>
            {notice ? (
              <View style={[styles.notice, { backgroundColor: '#FEF6EE', borderColor: palette.tint }]}>
                <Text style={[styles.noticeText, { color: palette.tint }]}>{notice}</Text>
              </View>
            ) : null}
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
                {repair.title}
              </Text>
              {isAdmin ? (
                <InlineMoreActions
                  open={menuOpen}
                  onToggle={() => setMenuOpen((open) => !open)}
                  actions={[
                    { label: '대기', onPress: () => setStatus('pending') },
                    { label: '진행', onPress: () => setStatus('doing') },
                    { label: '완료', onPress: () => setStatus('done') },
                    {
                      label: '삭제',
                      danger: true,
                      onPress: () =>
                        confirmAction('수리 요청을 삭제할까요?', repair.title, async () => {
                          try {
                            await api.remove(`/api/repairs/${repair.id}`);
                            showNotice('수리 요청을 삭제했습니다.');
                            router.replace('/repairs');
                          } catch (caught) {
                            showNotice('삭제하지 못했습니다.', caught instanceof Error ? caught.message : '');
                          }
                        }, '삭제'),
                    },
                  ]}
                />
              ) : null}
            </View>
            <Text style={[styles.meta, { color: palette.tint }]}>{repairStatusLabel[status]}</Text>
            {repair.place ? <Text style={[styles.body, { color: palette.text }]}>의뢰인  {repair.place}</Text> : null}
            {repair.photos && repair.photos.length > 0 ? (
              <View style={styles.photos}>
                {repair.photos.map((photo) => (
                  <Image key={photo.id} source={{ uri: fileUrl(photo.url) }} style={styles.photo} />
                ))}
              </View>
            ) : null}
            {repair.description ? <Text style={[styles.body, { color: palette.text }]}>{repair.description}</Text> : null}
            <Text style={[styles.body, { color: palette.muted }]}>{formatAuthorTime(repair.author, repair.createdAt)}</Text>
          </View>
          </>
        )}
      </RefreshableScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 10 },
  notice: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  noticeText: { fontSize: 15, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28, overflow: 'visible', zIndex: 2 },
  title: { flex: 1, fontSize: 24, fontWeight: '700' },
  meta: { fontSize: 16, fontWeight: '600' },
  photos: { flexDirection: 'row', gap: 8 },
  photo: { flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: '#F4F4F4', maxWidth: 112 },
  body: { fontSize: 16, lineHeight: 24 },
});
