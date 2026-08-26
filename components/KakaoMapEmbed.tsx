import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { api } from '@/lib/api';
import {
  coordsFromPlace,
  geocodeNominatim,
  mapWindowHtml,
  moveMarkerScript,
  parsePinMessage,
  sameCoords,
  type MapCoords,
} from '@/lib/maps';

export function KakaoMapEmbed({
  place,
  height,
  lat,
  lng,
  onPinMove,
}: {
  place: string;
  height?: number;
  lat?: number;
  lng?: number;
  onPinMove?: (coords: MapCoords) => void;
}) {
  const webRef = useRef<WebView>(null);
  const pinRef = useRef<MapCoords | null>(coordsFromPlace({ lat, lng }));
  const placeRef = useRef(place);
  const htmlRef = useRef('');
  const [html, setHtml] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const movable = Boolean(onPinMove);

  useEffect(() => {
    const given = coordsFromPlace({ lat, lng });
    const show = (next: MapCoords) => {
      pinRef.current = next;
      setError('');
      if (htmlRef.current) {
        webRef.current?.injectJavaScript(moveMarkerScript(next));
        return;
      }
      const page = mapWindowHtml(next, { movable });
      htmlRef.current = page;
      setHtml(page);
      setReady(false);
    };

    if (given) {
      placeRef.current = place;
      if (!htmlRef.current || !sameCoords(pinRef.current, given)) {
        show(given);
      }
      return;
    }

    const query = place.trim();
    if (query.length < 2) {
      pinRef.current = null;
      htmlRef.current = '';
      setHtml('');
      setError('');
      return;
    }

    if (query === placeRef.current.trim() && pinRef.current) {
      return;
    }

    let cancelled = false;
    placeRef.current = place;
    setError('');
    if (!htmlRef.current) {
      setReady(false);
    }
    api
      .get<MapCoords>(`/api/map?q=${encodeURIComponent(query)}`)
      .then((found) => coordsFromPlace(found) ?? Promise.reject(new Error('no coords')))
      .catch(() => geocodeNominatim(query))
      .then((found) => {
        if (cancelled) return;
        if (found) {
          show(found);
        } else {
          setError('지도를 찾지 못했습니다.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('지도를 찾지 못했습니다.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [place, lat, lng, movable]);

  return (
    <View style={[styles.wrap, height ? { height } : styles.fill]}>
      {error && !html ? (
        <View style={styles.loading}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
      {html && !ready ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#F07D22" />
        </View>
      ) : null}
      {html ? (
        <WebView
          ref={webRef}
          source={{ html, baseUrl: 'https://cdn.jsdelivr.net/' }}
          style={styles.webview}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          nestedScrollEnabled
          setSupportMultipleWindows={false}
          geolocationEnabled={false}
          onLoadEnd={() => setReady(true)}
          onMessage={(event) => {
            const pin = parsePinMessage(event.nativeEvent.data);
            if (!pin || !onPinMove) {
              return;
            }
            pinRef.current = pin;
            onPinMove(pin);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#F4F4F4',
  },
  fill: { flex: 1, borderRadius: 0 },
  webview: { flex: 1, backgroundColor: '#F4F4F4' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  error: { color: '#888888', fontSize: 13 },
});
