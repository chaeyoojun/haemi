import { useState, type ReactNode } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { PAGE_MAX_WIDTH, useConstrainedStyle } from '@/lib/layout';

type Props = ScrollViewProps & {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
};

export function RefreshableScroll({ onRefresh, children, contentContainerStyle, style, ...rest }: Props) {
  const palette = Colors[useColorScheme()];
  const [refreshing, setRefreshing] = useState(false);
  const constrained = useConstrainedStyle(PAGE_MAX_WIDTH);

  return (
    <ScrollView
      {...rest}
      style={[styles.fill, style]}
      contentContainerStyle={[styles.grow, constrained, contentContainerStyle]}
      alwaysBounceVertical={Platform.OS !== 'web'}
      overScrollMode="always"
      keyboardShouldPersistTaps={rest.keyboardShouldPersistTaps ?? 'handled'}
      refreshControl={
        Platform.OS === 'web' ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await onRefresh();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={palette.tint}
            colors={[palette.tint]}
          />
        )
      }>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
});
