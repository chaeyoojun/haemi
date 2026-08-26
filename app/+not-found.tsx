import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function NotFoundScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];

  return (
    <>
      <Stack.Screen options={{ title: '페이지 없음' }} />
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <Text style={[styles.title, { color: palette.text }]}>없는 화면입니다.</Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: palette.tint }]}>모임 목록으로 돌아가기</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
