import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const palette = Colors[useColorScheme()];
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  returnKeyType,
  onSubmitEditing,
  maxLength,
  keyboardType,
  autoFocus,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  minHeight?: number;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  maxLength?: number;
  keyboardType?: 'default' | 'number-pad' | 'numeric' | 'email-address' | 'phone-pad';
  autoFocus?: boolean;
}) {
  const palette = Colors[useColorScheme()];
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.muted}
      multiline={multiline}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      maxLength={maxLength}
      keyboardType={keyboardType}
      autoFocus={autoFocus}
      blurOnSubmit
      style={[
        styles.input,
        multiline ? styles.multiline : null,
        multiline && minHeight ? { minHeight } : null,
        { color: palette.text, backgroundColor: palette.card, borderColor: palette.border },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  field: { gap: 8, width: '100%' },
  label: { fontSize: 13, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    width: '100%',
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
});
