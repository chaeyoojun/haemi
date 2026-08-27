import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { API_URL, api } from '@/lib/api';
import {
  coordsFromPlace,
  geocodeNominatim,
  mapWindowHtml,
  moveMarkerScript,
  parseMapMessage,
  sameCoords,
  type MapCoords,
} from '@/lib/maps';
import type { AirspaceLookup } from '@/lib/types';

export function KakaoMapEmbed({
  place,
  name,
  height,
  lat,
  lng,
  zoom,
  flyZoom,
  airspace = false,
  onPinMove,
  onAirspace,
}: {
  place: string;
  name?: string;
  height?: number;
  lat?: number;
  lng?: number;
  zoom?: number;
  flyZoom?: number;
  airspace?: boolean;
  onPinMove?: (coords: MapCoords) => void;
  onAirspace?: (data: AirspaceLookup) => void;
}) {
  const webRef = useRef<WebView>(null);
  const pinRef = useRef<MapCoords | null>(coordsFromPlace({ lat, lng }));
  const flownRef = useRef<MapCoords | null>(null);
  const readyRef = useRef(false);
  const pendingFly = useRef<{ coords: MapCoords; zoom?: number } | null>(null);
  const placeRef = useRef(place);
  const htmlRef = useRef('');
  const [html, setHtml] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const movable = Boolean(onPinMove);
  const showAirspace = airspace || Boolean(onAirspace);

  const injectFly = (next: MapCoords) => {
    pendingFly.current = { coords: next, zoom: flyZoom };
    pinRef.current = next;
    if (!htmlRef.current || !readyRef.current) {
      return;
    }
    webRef.current?.injectJavaScript(moveMarkerScript(next, flyZoom));
    flownRef.current = next;
    pendingFly.current = null;
  };

  useEffect(() => {
    const given = coordsFromPlace({ lat, lng });
    const query = [name, place].filter((value) => value && value.trim()).join(' ').trim();
    const show = (next: MapCoords) => {
      pinRef.current = next;
      setError('');
      if (htmlRef.current) {
        injectFly(next);
        return;
      }
      const page = mapWindowHtml(next, { movable, airspace: showAirspace, apiUrl: API_URL, zoom });
      htmlRef.current = page;
      flownRef.current = next;
      readyRef.current = false;
      setHtml(page);
      setReady(false);
    };

    if (given) {
      placeRef.current = query || place;
      if (!htmlRef.current || !sameCoords(flownRef.current, given)) {
        show(given);
      }
      return;
    }

    if (query.length < 2) {
      pinRef.current = null;
      htmlRef.current = '';
      setHtml('');
      setError('');
      return;
    }

    if (query === placeRef.current && pinRef.current) {
      return;
    }

    let cancelled = false;
    placeRef.current = query;
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
  }, [place, name, lat, lng, movable, showAirspace, zoom, flyZoom]);

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
          onLoadEnd={() => {
            readyRef.current = true;
            setReady(true);
            const pending = pendingFly.current;
            if (pending) {
              webRef.current?.injectJavaScript(moveMarkerScript(pending.coords, pending.zoom));
              flownRef.current = pending.coords;
              pinRef.current = pending.coords;
              pendingFly.current = null;
            }
          }}
          onMessage={(event) => {
            const message = parseMapMessage(event.nativeEvent.data);
            if (!message) {
              return;
            }
            if (message.type === 'pin' && onPinMove) {
              pinRef.current = message;
              onPinMove(message);
              return;
            }
            if (message.type !== 'airspace-query' || !showAirspace) {
              return;
            }
            api
              .get<AirspaceLookup>(`/api/airspace?lat=${message.lat}&lng=${message.lng}`)
              .then((data) => {
                onAirspace?.(data);
              })
              .catch(() => undefined);
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
