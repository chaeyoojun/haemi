import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Input } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import type { PlaceHit } from '@/lib/maps';

export function PlaceSearch({
  value,
  onChange,
  onPickedName,
}: {
  value: string;
  onChange: (value: string) => void;
  onPickedName?: (name: string) => void;
}) {
  const palette = Colors[useColorScheme()];
  const [query, setQuery] = useState(value);
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const next = query.trim();
    if (picked || next.length < 2) {
      setHits([]);
      setError('');
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .get<{ places: PlaceHit[] }>(`/api/places?q=${encodeURIComponent(next)}`)
        .then((payload) => {
          setHits(payload.places);
          setError('');
        })
        .catch((caught) => {
          setHits([]);
          const message = caught instanceof Error ? caught.message : '';
          setError(
            message.includes('(404)')
              ? '주소 검색 서버가 아직 연결되지 않았습니다. 주소를 직접 입력해 주세요.'
              : message || '주소를 찾지 못했습니다.'
          );
        })
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, picked]);

  return (
    <Field label="주소 / 위치">
      <Input
        value={query}
        onChangeText={(text) => {
          setPicked(false);
          setQuery(text);
          onChange(text);
        }}
        placeholder="장소 이름이나 주소 검색"
        autoCorrect={false}
      />
      {searching ? <ActivityIndicator color={palette.tint} style={{ marginTop: 8 }} /> : null}
      {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
      {hits.length > 0 ? (
        <View style={[styles.list, { borderColor: palette.border }]}>
          {hits.map((hit) => (
            <Pressable
              key={hit.id}
              onPress={() => {
                const address = hit.address || hit.name;
                setPicked(true);
                setQuery(address);
                onChange(address);
                setHits([]);
                onPickedName?.(hit.name);
              }}
              style={styles.item}>
              <Text style={[styles.name, { color: palette.text }]}>{hit.name}</Text>
              {hit.address ? <Text style={[styles.address, { color: palette.muted }]}>{hit.address}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </Field>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 13, marginTop: 6 },
  list: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  item: { paddingHorizontal: 14, paddingVertical: 12, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EDEDED' },
  name: { fontSize: 15, fontWeight: '700' },
  address: { fontSize: 13 },
});
