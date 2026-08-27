import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { airspaceStatusLine } from '@/components/AirspaceCard';
import { Input } from '@/components/Form';
import { KakaoMapEmbed } from '@/components/KakaoMapEmbed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { coordsFromPlace, type MapCoords, type PlaceHit } from '@/lib/maps';
import type { AirspaceLookup } from '@/lib/types';

const KOREA = { lat: 36.35, lng: 127.85 };
const ONESTOP_URL = 'https://drone.onestop.go.kr';

export default function FlightScreen() {
  const navigation = useNavigation();
  const palette = Colors[useColorScheme()];
  const [airspace, setAirspace] = useState<AirspaceLookup | null>(null);
  const [coords, setCoords] = useState<MapCoords>(KOREA);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(false);
  const [error, setError] = useState('');
  const [mapKey, setMapKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setQuery('');
        setHits([]);
        setPicked(false);
        setError('');
        setSearching(false);
        setAirspace(null);
        setCoords(KOREA);
        setMapKey((value) => value + 1);
      };
    }, [])
  );

  useEffect(() => {
    if (picked) {
      return;
    }
    const next = query.trim();
    if (next.length < 2) {
      setHits([]);
      setError('');
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .get<{ places: PlaceHit[] }>(`/api/places?q=${encodeURIComponent(next)}`)
        .then((payload) => {
          if (payload.places.length > 0) {
            setHits(payload.places.slice(0, 6));
            setError('');
          }
        })
        .catch((caught) => {
          setError(caught instanceof Error ? caught.message : '주소를 찾지 못했습니다.');
        })
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, picked]);

  useEffect(() => {
    navigation.setOptions({
      title: '비행',
      headerTitleAlign: 'left',
      headerRight: () => (
        <Pressable
          onPress={() => {
            void Linking.openURL(ONESTOP_URL);
          }}
          hitSlop={8}
          style={styles.headerAction}
          accessibilityRole="link"
          accessibilityLabel="드론원스톱에서 비행승인 신청">
          <Text style={[styles.headerActionText, { color: palette.tint }]}>승인</Text>
        </Pressable>
      ),
    });
  }, [navigation, palette.tint]);

  const goToCoords = useCallback((next: MapCoords, label: string) => {
    setPicked(true);
    setHits([]);
    setError('');
    setQuery(label);
    setCoords(next);
  }, []);

  const goTo = async (hit: PlaceHit) => {
    const found = coordsFromPlace(hit);
    if (found) {
      goToCoords(found, hit.address || hit.name);
      return;
    }
    try {
      const mapped = await api.get<MapCoords>(`/api/map?q=${encodeURIComponent(hit.address || hit.name)}`);
      const next = coordsFromPlace(mapped);
      if (next) {
        goToCoords(next, hit.address || hit.name);
        return;
      }
    } catch {
      // fall through
    }
    setError('지도를 찾지 못했습니다.');
  };

  const searchNow = async () => {
    const next = query.trim();
    if (next.length < 2) {
      return;
    }
    const first = hits[0];
    if (first && coordsFromPlace(first)) {
      await goTo(first);
      return;
    }
    setSearching(true);
    try {
      const mapped = await api.get<MapCoords>(`/api/map?q=${encodeURIComponent(next)}`);
      const found = coordsFromPlace(mapped);
      if (found) {
        goToCoords(found, next);
        return;
      }
      setError('지도를 찾지 못했습니다.');
    } catch {
      setError('지도를 찾지 못했습니다.');
    } finally {
      setSearching(false);
    }
  };

  const status = airspaceStatusLine(airspace);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={[styles.statusBar, { borderBottomColor: palette.border }]}>
        <Text
          style={[styles.statusText, { color: status.text ? status.color : palette.muted }]}
          numberOfLines={2}>
          {status.text || '지도를 탭하면 공역이 표시됩니다'}
        </Text>
      </View>
      <View style={styles.mapArea}>
        <KakaoMapEmbed
          key={mapKey}
          place="대한민국"
          lat={coords.lat}
          lng={coords.lng}
          zoom={7}
          flyZoom={16}
          airspace
          onAirspace={setAirspace}
        />
        <KeyboardAvoidingView
          pointerEvents="box-none"
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View pointerEvents="box-none" style={styles.float}>
          {hits.length > 0 ? (
            <View style={[styles.list, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {hits.slice(0, 3).map((hit) => (
                <Pressable key={hit.id} onPress={() => goTo(hit)} style={styles.item}>
                  <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                    {hit.name}
                  </Text>
                  {hit.address ? (
                    <Text style={[styles.address, { color: palette.muted }]} numberOfLines={1}>
                      {hit.address}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Input
                value={query}
                onChangeText={(text) => {
                  setPicked(false);
                  setQuery(text);
                }}
                placeholder="주소나 장소 검색"
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={searchNow}
              />
            </View>
            <Pressable
              onPress={searchNow}
              style={[styles.searchBtn, { backgroundColor: palette.tint }]}
              accessibilityLabel="검색">
              <Text style={styles.searchBtnText}>검색</Text>
            </Pressable>
          </View>
          {searching ? <ActivityIndicator color={palette.tint} /> : null}
          {error ? <Text style={{ color: palette.danger, fontSize: 13 }}>{error}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  statusBar: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  mapArea: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  float: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchField: { flex: 1 },
  searchBtn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  searchBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  list: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 150,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  item: { paddingHorizontal: 14, paddingVertical: 8, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EDEDED' },
  name: { fontSize: 15, fontWeight: '700' },
  address: { fontSize: 12 },
  headerAction: { paddingHorizontal: 8, paddingVertical: 6 },
  headerActionText: { fontSize: 17, fontWeight: '700' },
});
