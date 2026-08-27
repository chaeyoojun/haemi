import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export type InlineAction = {
  label: string;
  danger?: boolean;
  onPress: () => void;
};

export function InlineMoreActions({
  open,
  onToggle,
  actions,
}: {
  open: boolean;
  onToggle: () => void;
  actions: InlineAction[];
}) {
  const palette = Colors[useColorScheme()];
  const buttonRef = useRef<View>(null);
  const [anchor, setAnchor] = useState({ top: 0, right: 16 });
  const screen = Dimensions.get('window');

  const openMenu = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      setAnchor({
        top: y + height + 4,
        right: Math.max(12, screenWidth - x - width),
      });
      if (!open) {
        onToggle();
      }
    });
  };

  return (
    <View style={styles.wrap} collapsable={false}>
      <Pressable
        ref={buttonRef}
        onPress={open ? onToggle : openMenu}
        hitSlop={10}
        style={styles.moreButton}
        accessibilityLabel="더보기">
        <Text style={[styles.more, { color: palette.muted }]}>⋮</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={onToggle}>
        <Pressable
          style={[styles.overlay, { width: screen.width, height: screen.height }]}
          onPress={onToggle}
          accessibilityLabel="메뉴 닫기">
          <Pressable
            onPress={() => undefined}
            style={[
              styles.menu,
              {
                top: anchor.top,
                right: anchor.right,
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
            ]}>
            {actions.map((action, index) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  onToggle();
                  action.onPress();
                }}
                style={[styles.item, index > 0 ? { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
                <Text style={[styles.label, { color: action.danger ? '#D92D20' : palette.text }]}>{action.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  menu: {
    position: 'absolute',
    minWidth: 112,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  item: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});
