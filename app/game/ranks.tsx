import { StyleSheet, Text, View } from 'react-native';

import { ResourceList } from '@/components/ResourceList';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/lib/auth';
import type { GameRank } from '@/lib/types';
import { useApiList } from '@/lib/useApiList';

const GOLD = '#E8C547';
const SILVER = '#C5CED6';
const BRONZE = '#D08A4A';

function PlaceMark({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <View style={[styles.trophy, { backgroundColor: GOLD }]}>
        <Text style={styles.trophyIcon}>🏆</Text>
      </View>
    );
  }
  if (rank === 2) {
    return (
      <View style={[styles.trophy, { backgroundColor: SILVER }]}>
        <Text style={styles.trophyIcon}>🏆</Text>
      </View>
    );
  }
  if (rank === 3) {
    return (
      <View style={[styles.trophy, { backgroundColor: BRONZE }]}>
        <Text style={styles.trophyIcon}>🏆</Text>
      </View>
    );
  }
  return (
    <View style={styles.place}>
      <Text style={styles.placeText}>{rank}</Text>
    </View>
  );
}

export default function GameRanksScreen() {
  const palette = Colors[useColorScheme()];
  const { displayName } = useAuth();
  const { items, ready, error, reload } = useApiList<GameRank>('/api/game/ranks');

  return (
    <ResourceList
      ready={ready}
      error={error}
      empty={items.length === 0}
      emptyTitle="아직 기록이 없습니다"
      emptyHint="게이트를 통과하면 로그인 이름 최고 점수가 집계됩니다."
      createHref="/game"
      createLabel=""
      canCreate={false}
      onRetry={reload}>
      {items.map((row) => {
        const mine = row.name === displayName;
        return (
          <View
            key={row.name}
            style={[
              styles.row,
              { borderColor: palette.border, backgroundColor: palette.card },
              mine ? styles.rowMine : null,
            ]}>
            <PlaceMark rank={row.rank} />
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={[styles.score, { color: mine ? palette.tint : palette.text }]}>{row.score}점</Text>
          </View>
        );
      })}
    </ResourceList>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowMine: {
    borderColor: '#F07D22',
  },
  trophy: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyIcon: { fontSize: 18 },
  place: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F4',
  },
  placeText: { fontSize: 14, fontWeight: '800', color: '#6B6B6B' },
  name: { flex: 1, fontSize: 16, fontWeight: '700' },
  score: { fontSize: 16, fontWeight: '800' },
});
