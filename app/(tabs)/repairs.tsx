import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { FilterTabs } from '@/components/FilterTabs';
import { MoreMenu } from '@/components/MoreMenu';
import { ResourceList } from '@/components/ResourceList';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { detailHref } from '@/lib/nav';
import { repairStatusLabel, type Repair, type RepairStatus } from '@/lib/types';
import { useApiList } from '@/lib/useApiList';

const tabs: { id: RepairStatus; label: string }[] = [
  { id: 'pending', label: '대기' },
  { id: 'doing', label: '진행' },
  { id: 'done', label: '완료' },
];

export default function RepairsScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { items, ready, error, reload, setItems } = useApiList<Repair>('/api/repairs');
  const [tab, setTab] = useState<RepairStatus>('pending');
  const [menuId, setMenuId] = useState<string | null>(null);

  const selected = items.find((item) => item.id === menuId) ?? null;
  const visible = items.filter((item) => item.status === tab);

  const setStatus = async (repair: Repair, status: RepairStatus) => {
    try {
      const updated = await api.patch<Repair>(`/api/repairs/${repair.id}`, { status });
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setTab(status);
    } catch (caught) {
      Alert.alert('상태를 바꾸지 못했습니다.', caught instanceof Error ? caught.message : '');
    }
  };

  const remove = (repair: Repair) => {
    Alert.alert('수리 요청을 삭제할까요?', repair.title, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.remove(`/api/repairs/${repair.id}`);
            setItems((current) => current.filter((item) => item.id !== repair.id));
          } catch (caught) {
            Alert.alert('삭제하지 못했습니다.', caught instanceof Error ? caught.message : '');
          }
        },
      },
    ]);
  };

  return (
    <ResourceList
      ready={ready}
      error={error}
      empty={visible.length === 0}
      emptyTitle={`${repairStatusLabel[tab]} 상태의 수리가 없습니다`}
      emptyHint="고장 난 곳이나 손볼 일을 올려 두면 모두가 볼 수 있습니다."
      createHref="/repair/new"
      createLabel="수리 요청"
      onRetry={reload}
      header={<FilterTabs value={tab} options={tabs} onChange={setTab} />}>
      {visible.map((repair) => (
        <RepairCard
          key={repair.id}
          repair={repair}
          isAdmin={isAdmin}
          onOpen={() => router.push(detailHref('/repair', repair.id))}
          onMore={() => setMenuId(repair.id)}
        />
      ))}
      <MoreMenu
        visible={Boolean(selected)}
        onClose={() => setMenuId(null)}
        actions={
          selected
            ? [
                { label: '대기', onPress: () => setStatus(selected, 'pending') },
                { label: '진행', onPress: () => setStatus(selected, 'doing') },
                { label: '완료', onPress: () => setStatus(selected, 'done') },
                { label: '삭제', danger: true, onPress: () => remove(selected) },
              ]
            : []
        }
      />
    </ResourceList>
  );
}

function RepairCard({
  repair,
  isAdmin,
  onOpen,
  onMore,
}: {
  repair: Repair;
  isAdmin: boolean;
  onOpen: () => void;
  onMore: () => void;
}) {
  const palette = Colors[useColorScheme()];
  const status = repairStatusLabel[repair.status] ?? repair.status;

  return (
    <Pressable
      onPress={onOpen}
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
        {repair.title}
      </Text>
      <Text style={[styles.status, { color: palette.tint }]} numberOfLines={1}>
        {status}
      </Text>
      {isAdmin ? (
        <Pressable onPress={onMore} hitSlop={10} style={styles.moreButton} accessibilityLabel="더보기">
          <Text style={[styles.more, { color: palette.muted }]}>⋮</Text>
        </Pressable>
      ) : null}
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
  status: { flexShrink: 0, fontSize: 13, fontWeight: '600' },
  moreButton: { paddingHorizontal: 2 },
  more: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
});
