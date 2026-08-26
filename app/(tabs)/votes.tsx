import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ItemCard, ResourceList } from '@/components/ResourceList';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { detailHref } from '@/lib/nav';
import type { Vote } from '@/lib/types';
import { useApiList } from '@/lib/useApiList';

type VoteTab = 'open' | 'closed';

function isVoteClosed(vote: Vote) {
  return vote.endsAt ? new Date(vote.endsAt).getTime() <= Date.now() : false;
}

function voteTotal(vote: Vote) {
  return vote.options.reduce((sum, option) => sum + option.count, 0);
}

export default function VotesScreen() {
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { items, ready, error, reload } = useApiList<Vote>('/api/votes');
  const [tab, setTab] = useState<VoteTab>('open');

  const visible = items.filter((vote) => (tab === 'closed' ? isVoteClosed(vote) : !isVoteClosed(vote)));

  return (
    <ResourceList
      ready={ready}
      error={error}
      empty={visible.length === 0}
      emptyTitle={tab === 'closed' ? '마감된 투표가 없습니다' : '진행 중인 투표가 없습니다'}
      emptyHint="날짜, 장소, 메뉴처럼 의견을 모을 때 투표를 만들어 보세요."
      createHref="/vote/new"
      createLabel="투표 만들기"
      onRetry={reload}
      header={
        <View style={[styles.tabs, { borderColor: palette.border }]}>
          <Pressable
            onPress={() => setTab('open')}
            style={[styles.tab, tab === 'open' ? { backgroundColor: palette.tint } : null]}>
            <Text style={[styles.tabLabel, { color: tab === 'open' ? '#FFFFFF' : palette.muted }]}>진행</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('closed')}
            style={[styles.tab, tab === 'closed' ? { backgroundColor: palette.tint } : null]}>
            <Text style={[styles.tabLabel, { color: tab === 'closed' ? '#FFFFFF' : palette.muted }]}>마감</Text>
          </Pressable>
        </View>
      }>
      {visible.map((vote) => {
        const total = voteTotal(vote);
        return (
          <ItemCard
            key={vote.id}
            title={vote.title}
            meta={tab === 'closed' ? `마감 · ${total}표` : `${total}표`}
            layout="row"
            onPress={() => router.push(detailHref('/vote', vote.id))}
          />
        );
      })}
    </ResourceList>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 4,
    borderWidth: 1,
    borderRadius: 14,
    gap: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabLabel: { fontSize: 15, fontWeight: '700' },
});
