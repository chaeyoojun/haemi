import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

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

  useEffect(() => {
    if (!id) return;
    api
      .get<Vote>(`/api/votes/${id}`)
      .then(setVote)
      .catch((caught) => setError(caught instanceof Error ? caught.message : '불러오지 못했습니다.'));
    AsyncStorage.getItem(`haemi.vote.${id}`).then((value) => {
      if (value) setVotedOptionId(value);
    });
  }, [id]);

  if (error) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <Text style={{ color: palette.danger }}>{error}</Text>
      </View>
    );
  }
  if (!vote) {
    return (
      <View style={[styles.screen, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.tint} />
      </View>
    );
  }

  const total = vote.options.reduce((sum, option) => sum + option.count, 0);
  const now = Date.now();
  const notStarted = vote.startsAt ? new Date(vote.startsAt).getTime() > now : false;
  const ended = vote.endsAt ? new Date(vote.endsAt).getTime() <= now : false;
  const canVote = !votedOptionId && !notStarted && !ended;

  const onCast = async (optionId: string) => {
    if (votedOptionId) {
      Alert.alert('이미 투표했습니다.', '이 기기에서는 한 번만 참여할 수 있습니다.');
      return;
    }
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

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>{vote.title}</Text>
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
      {isAdmin ? (
        <Pressable
          onPress={() =>
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
            ])
          }
          style={[styles.deleteButton, { borderColor: palette.danger }]}>
          <Text style={[styles.deleteText, { color: palette.danger }]}>삭제</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 10, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700' },
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
  deleteButton: { marginTop: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteText: { fontSize: 15, fontWeight: '700' },
});
