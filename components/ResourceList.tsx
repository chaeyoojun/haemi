import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { RefreshableScroll } from '@/components/RefreshableScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

type Props = {
  ready: boolean;
  error: string;
  empty: boolean;
  emptyTitle: string;
  emptyHint: string;
  createHref: Href;
  createLabel: string;
  canCreate?: boolean;
  header?: ReactNode;
  onRetry: () => void | Promise<void>;
  children: ReactNode;
};

export function ResourceList({
  ready,
  error,
  empty,
  emptyTitle,
  emptyHint: _emptyHint,
  createHref,
  createLabel,
  canCreate = true,
  header,
  onRetry,
  children,
}: Props) {
  const palette = Colors[useColorScheme()];

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      {header}
      <RefreshableScroll onRefresh={onRetry} contentContainerStyle={styles.content}>
        {error ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.body, { color: palette.danger }]}>{error}</Text>
            <Pressable onPress={onRetry} style={[styles.primaryButton, { backgroundColor: palette.tint }]}>
              <Text style={styles.primaryButtonText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : !ready ? (
          <ActivityIndicator color={palette.tint} style={{ marginTop: 24 }} />
        ) : empty ? (
          <Text style={[styles.emptyText, { color: palette.muted }]}>{emptyTitle}</Text>
        ) : (
          children
        )}
      </RefreshableScroll>
      {canCreate ? (
        <Link href={createHref} asChild>
          <Pressable
            style={StyleSheet.flatten([styles.fab, { backgroundColor: palette.tint }])}
            accessibilityLabel={createLabel}>
            <Icon ios="plus" android="add" color="#FFFFFF" size={28} />
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

export function ItemCard({
  title,
  meta,
  body,
  onPress,
  more,
  layout = 'stack',
}: {
  title: string;
  meta?: string;
  body?: string;
  onPress: () => void;
  more?: ReactNode;
  layout?: 'stack' | 'row';
}) {
  const palette = Colors[useColorScheme()];
  if (layout === 'row') {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.card, styles.rowCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.title, styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={[styles.meta, styles.rowMeta, { color: palette.tint }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {more}
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {meta ? <Text style={[styles.meta, { color: palette.tint }]}>{meta}</Text> : null}
      {body ? <Text style={[styles.body, { color: palette.muted }]}>{body}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 96, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 20, gap: 8 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 22,
  },
  title: { fontSize: 18, fontWeight: '700' },
  rowTitle: { flex: 1, fontSize: 16 },
  meta: { fontSize: 14, fontWeight: '600' },
  rowMeta: { flexShrink: 0, fontSize: 13 },
  body: { fontSize: 15, lineHeight: 22 },
  emptyText: { fontSize: 15, paddingTop: 8 },
  primaryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
