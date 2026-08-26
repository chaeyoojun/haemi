import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { Field } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { formatDateTime } from '@/lib/format';

function withDate(base: Date, picked: Date) {
  const next = new Date(base);
  next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return next;
}

function withTime(base: Date, picked: Date) {
  const next = new Date(base);
  next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return next;
}

export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
}: {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  minimumDate?: Date;
}) {
  const palette = Colors[useColorScheme()];
  const [mode, setMode] = useState<'date' | 'time' | 'datetime' | null>(null);

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      setMode(null);
      return;
    }
    const picked = selected ?? value;
    if (Platform.OS === 'ios') {
      onChange(picked);
      return;
    }
    if (mode === 'date') {
      onChange(withDate(value, picked));
      setMode(null);
      setTimeout(() => setMode('time'), 250);
      return;
    }
    onChange(withTime(value, picked));
    setMode(null);
  };

  return (
    <Field label={label}>
      <Pressable
        onPress={() =>
          setMode((current) => (current ? null : Platform.OS === 'ios' ? 'datetime' : 'date'))
        }
        style={[styles.input, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.value, { color: palette.text }]}>{formatDateTime(value.toISOString())}</Text>
      </Pressable>
      {mode ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          onChange={onPick}
        />
      ) : null}
    </Field>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  value: { fontSize: 16 },
});
