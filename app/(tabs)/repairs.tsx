import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { FilterTabs } from '@/components/FilterTabs';
import { ResourceList } from '@/components/ResourceList';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { detailHref } from '@/lib/nav';
import { withAuthor } from '@/lib/format';
import { repairStatusLabel, type Repair, type RepairStatus } from '@/lib/types';
import { useApiList } from '@/lib/useApiList';

const tabs: { id: RepairStatus; label: string }[] = [
  { id: 'pending', label: '대기' },
  { id: 'doing', label: '진행' },
  { id: 'done', label: '완료' },
];

export default function RepairsScreen() {
  const router = useRouter();
  const { items, ready, error, reload } = useApiList<Repair>('/api/repairs');
  const [tab, setTab] = useState<RepairStatus>('pending');
  const visible = items.filter((item) => item.status === tab);

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
        <RepairCard key={repair.id} repair={repair} onOpen={() => router.push(detailHref('/repair', repair.id))} />
      ))}
    </ResourceList>
  );
}

function RepairCard({ repair, onOpen }: { repair: Repair; onOpen: () => void }) {
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
        {withAuthor(repair.author, status) || status}
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
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  status: { flexShrink: 0, fontSize: 13, fontWeight: '600' },
});
