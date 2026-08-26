import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { BLOCK_MAP_APP_SCHEMES_JS, KAKAO_MAP_DESKTOP_UA, KAKAO_MAP_WEB_HEADERS, kakaoMapUrl, shouldOpenInMapView } from '@/lib/maps';

export function KakaoMapEmbed({ place, height }: { place: string; height?: number }) {
  const uri = useMemo(() => kakaoMapUrl(place), [place]);
  const [ready, setReady] = useState(false);

  return (
    <View style={[styles.wrap, height ? { height } : styles.fill]}>
      {!ready ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#F07D22" />
        </View>
      ) : null}
      <WebView
        source={{ uri, headers: KAKAO_MAP_WEB_HEADERS }}
        style={styles.webview}
        userAgent={KAKAO_MAP_DESKTOP_UA}
        originWhitelist={['http://*', 'https://*']}
        javaScriptEnabled
        domStorageEnabled
        nestedScrollEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        setSupportMultipleWindows={false}
        geolocationEnabled={false}
        injectedJavaScriptBeforeContentLoaded={BLOCK_MAP_APP_SCHEMES_JS}
        onShouldStartLoadWithRequest={(request) => shouldOpenInMapView(request.url)}
        onLoadEnd={() => setReady(true)}
      />
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
  webview: { flex: 1, backgroundColor: '#FFFFFF' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
});
