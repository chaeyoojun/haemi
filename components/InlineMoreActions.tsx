import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export function InlineMoreActions({
  open,
  onToggle,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const palette = Colors[useColorScheme()];

  return (
    <View style={styles.wrap}>
      {open ? (
        <View style={styles.flyout}>
          <Pressable onPress={onEdit} hitSlop={6} style={styles.action}>
            <Text style={[styles.label, { color: palette.text }]}>수정</Text>
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={6} style={styles.action}>
            <Text style={[styles.label, styles.danger]}>삭제</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable onPress={onToggle} hitSlop={10} style={styles.moreButton} accessibilityLabel="더보기">
        <Text style={[styles.more, { color: palette.muted }]}>⋮</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    justifyContent: 'center',
  },
  flyout: {
    position: 'absolute',
    right: 28,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingLeft: 10,
  },
  action: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  danger: {
    color: '#D92D20',
  },
  moreButton: {
    paddingHorizontal: 2,
  },
  more: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
});
