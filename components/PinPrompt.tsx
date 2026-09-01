import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Input } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { isModelPin } from '@/lib/modelPin';

export function PinPrompt({
  visible,
  title,
  message = '등록할 때 넣은 숫자 4자리 비밀번호를 입력해 주세요.',
  error,
  submitting,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  message?: string;
  error?: string;
  submitting?: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (pin: string) => void;
}) {
  const palette = Colors[useColorScheme()];
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (visible) {
      setPin('');
    }
  }, [visible]);

  const ready = isModelPin(pin) && !submitting;
  const confirmLabel = submitLabel || '확인';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel} accessibilityLabel="닫기">
        <Pressable
          onPress={() => undefined}
          style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          <Text style={[styles.message, { color: palette.muted }]}>{message}</Text>
          <Field label="비밀번호">
            <Input
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))}
              placeholder="숫자 4자리"
              secureTextEntry
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={4}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (ready) {
                  onSubmit(pin);
                }
              }}
            />
          </Field>
          {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={[styles.button, { borderColor: palette.border, borderWidth: 1 }]}>
              <Text style={[styles.buttonText, { color: palette.muted }]}>취소</Text>
            </Pressable>
            <Pressable
              onPress={() => onSubmit(pin)}
              disabled={!ready}
              style={[styles.button, { backgroundColor: palette.tint, opacity: ready ? 1 : 0.6 }]}>
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>{submitting ? '확인 중...' : confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '800' },
  message: { fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
