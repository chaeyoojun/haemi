import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { InlineMoreActions } from '@/components/InlineMoreActions';
import { RefreshableScroll } from '@/components/RefreshableScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPeriod } from '@/lib/format';
import type { Vote } from '@/lib/types';

export default function VoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { isAdmin } = useAuth();
  const [vote, setVote] = useState<Vote | null>(null);
  const [votedOptionId, setVotedOptionId] = useState('');
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setVote(await api.get<Vote>(`/api/votes/${id}`));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.');
    }
    const value = await AsyncStorage.getItem(`haemi.vote.${id}`);
    if (value) setVotedOptionId(value);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onCast = async (optionId: string) => {
    if (!vote) return;
    if (votedOptionId) {
      Alert.alert('이미 투표했습니다.', '이 기기에서는 한 번만 참여할 수 있습니다.');
      return;
    }
    const now = Date.now();
    const notStarted = vote.startsAt ? new Date(vote.startsAt).getTime() > now : false;
    const ended = vote.endsAt ? new Date(vote.endsAt).getTime() <= now : false;
    if (notStarted) {
      Alert.alert('아직 시작되지 않았습니다.', '시작 시간이 되면 투표할 수 있습니다.');
      return;
    }
    if (ended) {
      Alert.alert('마감된 투표입니다.', '기간이 지나 참여할 수 없습니다.');
      return;
    }
    const updated = await api.create<Vote>(`/api/votes/${vote.id}/cast`, { optionId });
    setVote(updated);
    setVotedOptionId(optionId);
    await AsyncStorage.setItem(`haemi.vote.${vote.id}`, optionId);
  };

  const total = vote ? vote.options.reduce((sum, option) => sum + option.count, 0) : 0;
  const now = Date.now();
  const notStarted = vote?.startsAt ? new Date(vote.startsAt).getTime() > now : false;
  const ended = vote?.endsAt ? new Date(vote.endsAt).getTime() <= now : false;
  const canVote = Boolean(vote) && !votedOptionId && !notStarted && !ended;

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <RefreshableScroll onRefresh={load} contentContainerStyle={styles.content}>
        {error && !vote ? (
          <Text style={{ color: palette.danger }}>{error}</Text>
        ) : !vote ? (
          <ActivityIndicator color={palette.tint} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.header}>
                <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
                  {vote.title}
                </Text>
                {isAdmin ? (
                  <InlineMoreActions
                    open={menuOpen}
                    onToggle={() => setMenuOpen((open) => !open)}
                    actions={[
                      { label: '수정', onPress: () => router.push(`/vote/edit/${vote.id}`) },
                      {
                        label: '삭제',
                        danger: true,
                        onPress: () =>
                          Alert.alert('투표를 삭제할까요?', vote.title, [
                            { text: '취소', style: 'cancel' },
                            {
                              text: '삭제',
                              style: 'destructive',
                              onPress: async () => {
                                await api.remove(`/api/votes/${vote.id}`);
                                router.replace('/votes');
                              },
                            },
                          ]),
                      },
                    ]}
                  />
                ) : null}
              </View>
              {vote.body ? <Text style={[styles.body, { color: palette.text }]}>{vote.body}</Text> : null}
              {vote.startsAt && vote.endsAt ? (
                <Text style={[styles.body, { color: palette.muted }]}>{formatPeriod(vote.startsAt, vote.endsAt)}</Text>
              ) : null}
              <Text style={[styles.body, { color: palette.muted }]}>
                총 {total}표
                {notStarted ? ' · 시작 전' : ended ? ' · 마감' : ''}
              </Text>
            </View>
            {vote.options.map((option) => {
              const selected = votedOptionId === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => onCast(option.id)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: palette.card,
                      borderColor: selected ? palette.tint : palette.border,
                      opacity: canVote || selected ? 1 : 0.7,
                    },
                  ]}>
                  <Text style={[styles.optionLabel, { color: palette.text }]}>{option.label}</Text>
                  <Text style={[styles.optionCount, { color: palette.tint }]}>{option.count}표</Text>
                </Pressable>
              );
            })}
          </>
        )}
      </RefreshableScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, gap: 10, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 10, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28, overflow: 'visible', zIndex: 2 },
  title: { flex: 1, fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
  option: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: { fontSize: 16, fontWeight: '600', flex: 1, paddingRight: 12 },
  optionCount: { fontSize: 15, fontWeight: '700' },
});
