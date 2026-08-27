import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { FORM_MAX_WIDTH } from '@/lib/layout';

export function FormScroll({ children }: { children: ReactNode }) {
  const palette = Colors[useColorScheme()];
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.column, Platform.OS === 'web' && styles.webColumn]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  webScroll: { alignItems: 'center' },
  column: { width: '100%', gap: 16 },
  webColumn: { maxWidth: FORM_MAX_WIDTH },
});
