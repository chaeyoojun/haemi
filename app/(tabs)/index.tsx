import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { ResourceList } from '@/components/ResourceList';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { detailHref } from '@/lib/nav';
import type { Notice } from '@/lib/types';
import { useApiList } from '@/lib/useApiList';

export default function NoticesScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { items, ready, error, reload } = useApiList<Notice>('/api/notices');

  return (
    <ResourceList
      ready={ready}
      error={error}
      empty={items.length === 0}
      emptyTitle="공지가 없습니다"
      emptyHint={
        isAdmin
          ? '모임 일정, 회비, 준비물 같은 소식을 올려 보세요.'
          : '관리자가 올린 공지를 여기서 확인할 수 있습니다.'
      }
      createHref="/notice/new"
      createLabel="공지 작성"
      canCreate={isAdmin}
      onRetry={reload}>
      {items.map((notice) => (
        <NoticeRow
          key={notice.id}
          title={notice.title}
          date={formatDate(notice.createdAt)}
          onPress={() => router.push(detailHref('/notice', notice.id))}
        />
      ))}
    </ResourceList>
  );
}

function NoticeRow({
  title,
  date,
  onPress,
}: {
  title: string;
  date: string;
  onPress: () => void;
}) {
  const palette = Colors[useColorScheme()];
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.date, { color: palette.tint }]} numberOfLines={1}>
        {date}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  date: { flexShrink: 0, fontSize: 13, fontWeight: '600' },
});
