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
import { formatAuthorTime, formatPeriod } from '@/lib/format';
import { syncVoteEndAlerts } from '@/lib/notifications';
import type { Vote } from '@/lib/types';

function voteKey(id: string) {
  return `haemi.vote.${id}`;
}

function parseVotedIds(value: string | null) {
  if (!value) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }
  } catch {
    // Older builds stored a single option id.
  }
  return [value];
}

export default function VoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const { isAdmin } = useAuth();
  const [vote, setVote] = useState<Vote | null>(null);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setVote(await api.get<Vote>(`/api/votes/${id}`));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.');
    }
    const stored = parseVotedIds(await AsyncStorage.getItem(voteKey(id)));
    setVotedIds(stored);
    setPickedIds(stored);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onToggle = (optionId: string) => {
    if (!vote || votedIds.length > 0) {
      return;
    }
    const now = Date.now();
    if (vote.startsAt && new Date(vote.startsAt).getTime() > now) {
      Alert.alert('아직 시작되지 않았습니다.', '시작 시간이 되면 투표할 수 있습니다.');
      return;
    }
    if (vote.endsAt && new Date(vote.endsAt).getTime() <= now) {
      Alert.alert('마감된 투표입니다.', '기간이 지나 참여할 수 없습니다.');
      return;
    }
    if (vote.allowMultiple === false) {
      setPickedIds([optionId]);
      return;
    }
    setPickedIds((current) =>
      current.includes(optionId) ? current.filter((item) => item !== optionId) : [...current, optionId]
    );
  };

  const onCast = async () => {
    if (!vote || votedIds.length > 0 || pickedIds.length === 0) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api.create<Vote>(`/api/votes/${vote.id}/cast`, {
        optionId: pickedIds[0],
        optionIds: pickedIds,
      });
      setVote(updated);
      setVotedIds(pickedIds);
      await AsyncStorage.setItem(voteKey(vote.id), JSON.stringify(pickedIds));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '투표하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const onUncast = async () => {
    if (!vote || votedIds.length === 0) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api.create<Vote>(`/api/votes/${vote.id}/uncast`, {
        optionId: votedIds[0],
        optionIds: votedIds,
      });
      setVote(updated);
      setVotedIds([]);
      setPickedIds([]);
      await AsyncStorage.removeItem(voteKey(vote.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '투표를 취소하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const total = vote ? vote.options.reduce((sum, option) => sum + option.count, 0) : 0;
  const now = Date.now();
  const notStarted = vote?.startsAt ? new Date(vote.startsAt).getTime() > now : false;
  const ended = vote?.endsAt ? new Date(vote.endsAt).getTime() <= now : false;
  const hasVoted = votedIds.length > 0;
  const canVote = Boolean(vote) && !hasVoted && !notStarted && !ended;
  const allowMultiple = vote?.allowMultiple !== false;
  const highlightIds = hasVoted ? votedIds : pickedIds;

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
                                void syncVoteEndAlerts();
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
                {formatAuthorTime(vote.author, vote.createdAt)}
              </Text>
              <Text style={[styles.body, { color: palette.muted }]}>
                총 {total}표
                {notStarted ? ' · 시작 전' : ended ? ' · 마감' : allowMultiple ? ' · 여러 개 선택' : ''}
              </Text>
            </View>
            {vote.options.map((option) => {
              const selected = highlightIds.includes(option.id);
              const voters = option.voters || [];
              return (
                <Pressable
                  key={option.id}
                  onPress={() => onToggle(option.id)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: palette.card,
                      borderColor: selected ? palette.tint : palette.border,
                      opacity: canVote || selected ? 1 : 0.7,
                    },
                  ]}>
                  <View style={styles.optionRow}>
                    <Text style={[styles.optionLabel, { color: palette.text }]}>{option.label}</Text>
                    <Text style={[styles.optionCount, { color: palette.tint }]}>{option.count}표</Text>
                  </View>
                  {voters.length > 0 ? (
                    <Text style={[styles.optionVoters, { color: palette.muted }]}>{voters.join(' · ')}</Text>
                  ) : null}
                </Pressable>
              );
            })}
            {error && vote ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
            {canVote ? (
              <Pressable
                onPress={() => void onCast()}
                disabled={saving || pickedIds.length === 0}
                style={[
                  styles.submit,
                  { backgroundColor: palette.tint, opacity: saving || pickedIds.length === 0 ? 0.7 : 1 },
                ]}>
                <Text style={styles.submitText}>
                  {saving ? '투표 중...' : allowMultiple ? `투표하기 (${pickedIds.length})` : '투표하기'}
                </Text>
              </Pressable>
            ) : null}
            {hasVoted && !notStarted && !ended ? (
              <Pressable
                onPress={() =>
                  Alert.alert('투표를 취소할까요?', '취소하면 다시 고를 수 있습니다.', [
                    { text: '닫기', style: 'cancel' },
                    {
                      text: '취소하기',
                      style: 'destructive',
                      onPress: () => {
                        void onUncast();
                      },
                    },
                  ])
                }
                disabled={saving}
                style={[
                  styles.cancel,
                  { borderColor: palette.danger, opacity: saving ? 0.7 : 1 },
                ]}>
                <Text style={[styles.cancelText, { color: palette.danger }]}>
                  {saving ? '취소 중...' : '투표 취소'}
                </Text>
              </Pressable>
            ) : null}
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
    gap: 6,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLabel: { fontSize: 16, fontWeight: '600', flex: 1, paddingRight: 12 },
  optionCount: { fontSize: 15, fontWeight: '700' },
  optionVoters: { fontSize: 13, lineHeight: 20 },
  submit: { marginTop: 8, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cancel: { marginTop: 8, borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1 },
  cancelText: { fontSize: 16, fontWeight: '700' },
});
