import { useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Input } from '@/components/Form';
import { ResourceList } from '@/components/ResourceList';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useWideLayout } from '@/lib/layout';
import { MODEL_CATEGORIES, matchesModelQuery, modelCoverUrl, uniqueValues } from '@/lib/modelCatalog';
import { detailHref } from '@/lib/nav';
import type { Model3d } from '@/lib/types';
import { useApiList } from '@/lib/useApiList';

const GRID_GAP = 12;
const webGrid =
  Platform.OS === 'web'
    ? ({
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        minWidth: 0,
      } as const)
    : null;

export default function ModelsScreen() {
  const router = useRouter();
  const palette = Colors[useColorScheme()];
  const wide = useWideLayout();
  const { items, ready, error, reload } = useApiList<Model3d>('/api/models');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  const categories = useMemo(() => {
    const extras = uniqueValues(items.map((item) => item.category)).filter(
      (item) => !(MODEL_CATEGORIES as readonly string[]).includes(item)
    );
    return [...MODEL_CATEGORIES, ...extras];
  }, [items]);

  const visible = useMemo(
    () => items.filter((item) => matchesModelQuery(item, query, category)),
    [items, query, category]
  );

  return (
    <ResourceList
      ready={ready}
      error={error}
      empty={visible.length === 0}
      emptyTitle={items.length === 0 ? '3D 파일이 없습니다' : '검색 결과가 없습니다'}
      emptyHint="프레임, 안테나, 고글 마운트 같은 STL·OBJ 파일을 올려 공유하세요."
      createHref="/model/new"
      createLabel="3D 파일 등록"
      flush
      onRetry={reload}
      header={
        <View style={styles.header}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="기체명, 구분, 파일명으로 검색"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <View style={styles.chips}>
            <Pressable
              onPress={() => setCategory('')}
              style={[
                styles.chip,
                { borderColor: category ? palette.border : palette.tint },
                category ? null : { backgroundColor: palette.tint },
              ]}>
              <Text style={[styles.chipText, { color: category ? palette.text : '#FFFFFF' }]}>전체</Text>
            </Pressable>
            {categories.map((item) => {
              const selected = category === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(selected ? '' : item)}
                  style={[
                    styles.chip,
                    { borderColor: selected ? palette.tint : palette.border },
                    selected ? { backgroundColor: palette.tint } : null,
                  ]}>
                  <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : palette.text }]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }>
      <View style={[styles.grid, wide ? webGrid : null]}>
        {visible.map((model) => {
          const cover = modelCoverUrl(model);
          return (
            <Pressable
              key={model.id}
              onPress={() => router.push(detailHref('/model', model.id))}
              style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.cover} resizeMode="contain" />
              ) : (
                <View style={[styles.cover, styles.coverEmpty, { borderColor: palette.border }]}>
                  <Text style={[styles.coverEmptyText, { color: palette.muted }]}>미리보기 없음</Text>
                </View>
              )}
              <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={2}>
                {model.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ResourceList>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 4, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  grid: { width: '100%', gap: GRID_GAP },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#F4F4F4',
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  coverEmptyText: { fontSize: 13, fontWeight: '700' },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
