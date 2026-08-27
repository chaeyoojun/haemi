import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AirspaceCard } from '@/components/AirspaceCard';
import { Field, Input } from '@/components/Form';
import { KakaoMapEmbed } from '@/components/KakaoMapEmbed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { coordsFromPlace, reverseNominatim, type MapCoords, type PlaceHit } from '@/lib/maps';
import type { AirspaceLookup } from '@/lib/types';

export function PlaceSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const palette = Colors[useColorScheme()];
  const { height } = useWindowDimensions();
  const mapHeight = Math.max(360, Math.round(height * 0.42));
  const [query, setQuery] = useState(value);
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(Boolean(value.trim()));
  const [mapPlace, setMapPlace] = useState(value.trim());
  const [mapCoords, setMapCoords] = useState<MapCoords | null>(null);
  const [airspace, setAirspace] = useState<AirspaceLookup | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const next = query.trim();
    const timer = setTimeout(
      () => {
        setMapPlace(next.length >= 2 ? next : '');
      },
      picked ? 0 : 500
    );
    return () => clearTimeout(timer);
  }, [query, picked]);

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

  const movePin = async (coords: MapCoords) => {
    setPicked(true);
    setHits([]);
    setMapCoords(coords);
    try {
      const found = await api.get<{ address: string }>(`/api/map/reverse?lat=${coords.lat}&lng=${coords.lng}`);
      if (found.address) {
        setQuery(found.address);
        setMapPlace(found.address);
        onChange(found.address);
        return;
      }
    } catch {
      // production may not have reverse yet
    }
    const address = await reverseNominatim(coords);
    if (address) {
      setQuery(address);
      setMapPlace(address);
      onChange(address);
    }
  };

  return (
    <Field label="주소 / 위치">
      <Input
        value={query}
        onChangeText={(text) => {
          setPicked(false);
          setQuery(text);
          setMapCoords(null);
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
                setMapPlace(address);
                setMapCoords(coordsFromPlace(hit));
                onChange(address);
                setHits([]);
              }}
              style={styles.item}>
              <Text style={[styles.name, { color: palette.text }]}>{hit.name}</Text>
              {hit.address ? <Text style={[styles.address, { color: palette.muted }]}>{hit.address}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {mapPlace.length >= 2 ? (
        <View style={styles.map}>
          <KakaoMapEmbed
            place={mapPlace}
            lat={mapCoords?.lat}
            lng={mapCoords?.lng}
            height={mapHeight}
            airspace
            onPinMove={movePin}
            onAirspace={setAirspace}
          />
          <View style={{ marginTop: 10 }}>
            <AirspaceCard data={airspace} />
          </View>
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
  map: { marginTop: 10, width: '100%' },
});
