import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateTimeField } from '@/components/DateTimeField';
import { Field, Input } from '@/components/Form';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

const MAX_OPTIONS = 12;

export function cleanVoteOptions(options: string[]) {
  return options.map((option) => option.trim()).filter(Boolean);
}

export function VoteFormFields({
  title,
  body,
  options,
  allowMultiple,
  startsAt,
  endsAt,
  onTitle,
  onBody,
  onOptions,
  onAllowMultiple,
  onStartsAt,
  onEndsAt,
}: {
  title: string;
  body: string;
  options: string[];
  allowMultiple: boolean;
  startsAt: Date;
  endsAt: Date;
  onTitle: (value: string) => void;
  onBody: (value: string) => void;
  onOptions: (value: string[]) => void;
  onAllowMultiple: (value: boolean) => void;
  onStartsAt: (value: Date) => void;
  onEndsAt: (value: Date) => void;
}) {
  const palette = Colors[useColorScheme()];

  const setOption = (index: number, value: string) => {
    onOptions(options.map((option, item) => (item === index ? value : option)));
  };

  return (
    <>
      <Field label="투표 제목">
        <Input value={title} onChangeText={onTitle} placeholder="다음 모임 장소" />
      </Field>
      <Field label="설명">
        <Input value={body} onChangeText={onBody} placeholder="선택 기준이나 마감 안내" multiline />
      </Field>
      <DateTimeField label="시작" value={startsAt} onChange={onStartsAt} />
      <DateTimeField label="마감" value={endsAt} onChange={onEndsAt} minimumDate={startsAt} />
      <Pressable onPress={() => onAllowMultiple(!allowMultiple)} style={styles.toggleRow}>
        <View
          style={[
            styles.check,
            { borderColor: palette.tint, backgroundColor: allowMultiple ? palette.tint : '#FFFFFF' },
          ]}
        />
        <Text style={[styles.toggleLabel, { color: palette.text }]}>여러 개 선택 가능</Text>
      </Pressable>
      {options.map((option, index) => (
        <Field key={index} label={`선택지 ${index + 1}`}>
          <View style={styles.optionRow}>
            <View style={styles.optionInput}>
              <Input
                value={option}
                onChangeText={(value) => setOption(index, value)}
                placeholder={index < 2 ? '필수' : '선택'}
              />
            </View>
            {options.length > 2 ? (
              <Pressable
                onPress={() => onOptions(options.filter((_, item) => item !== index))}
                style={[styles.remove, { borderColor: palette.border }]}
                accessibilityLabel="선택지 삭제">
                <Text style={[styles.removeText, { color: palette.muted }]}>×</Text>
              </Pressable>
            ) : null}
          </View>
        </Field>
      ))}
      {options.length < MAX_OPTIONS ? (
        <Pressable
          onPress={() => onOptions([...options, ''])}
          style={[styles.add, { borderColor: palette.tint }]}>
          <Text style={[styles.addText, { color: palette.tint }]}>선택지 추가</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  check: { width: 22, height: 22, borderWidth: 2, borderRadius: 6 },
  toggleLabel: { fontSize: 16, fontWeight: '600' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionInput: { flex: 1 },
  remove: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontSize: 22, fontWeight: '600', lineHeight: 24 },
  add: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addText: { fontSize: 15, fontWeight: '700' },
});
