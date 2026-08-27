import { StyleSheet, Text, View } from 'react-native';

import type { AirspaceLookup } from '@/lib/types';

const LEVEL = {
  'no-fly': { bg: '#FDECEA', fg: '#B42318', border: '#FECDCA' },
  permit: { bg: '#FEF6EE', fg: '#B54708', border: '#F9DBAF' },
  ua: { bg: '#ECFDF3', fg: '#027A48', border: '#A6F4C5' },
  clear: { bg: '#F5F5F5', fg: '#444444', border: '#E5E5E5' },
};

const SHORT_TITLE: Record<string, string> = {
  비행금지구역: '금지',
  비행제한구역: '제한',
  관제권: '관제',
  비행장교통구역: 'ATZ',
  위험구역: '위험',
  초경량비행장치공역: 'UA',
  드론시범사업구역: '시범',
};

export function airspaceStatusLine(data: AirspaceLookup | null) {
  if (!data) {
    return { text: '', color: '#6B6B6B' };
  }
  const tone = LEVEL[data.level];
  if (data.level === 'clear' || data.zones.length === 0) {
    return { text: '제한 없음', color: tone.fg };
  }
  const text = data.zones
    .slice(0, 3)
    .map((zone) => {
      const title = SHORT_TITLE[zone.title] || zone.title;
      const altitude = zone.altitude.replace(/\s+/g, '');
      return [title, zone.ident, altitude].filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .join(' · ');
  return { text, color: tone.fg };
}

export function AirspaceCard({ data }: { data: AirspaceLookup | null; compact?: boolean }) {
  if (!data) {
    return null;
  }
  const status = airspaceStatusLine(data);
  return (
    <View style={[styles.card, { backgroundColor: LEVEL[data.level].bg, borderColor: LEVEL[data.level].border }]}>
      <Text style={[styles.line, { color: status.color }]} numberOfLines={2}>
        {status.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  line: { fontSize: 14, fontWeight: '800' },
});
