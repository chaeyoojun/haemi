import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

export const brandHero = require('../assets/images/login-hero.png');

export function brandFillSize(width: number, height: number) {
  return Math.min(width, height) * 0.92;
}

type Props = {
  onFinish?: () => void;
};

export function BrandSplash({ onFinish }: Props) {
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const { width, height } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(1)).current;
  const size = brandFillSize(width, height);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    if (!onFinish) {
      return;
    }

    const finish = () => {
      if (finished.current) {
        return;
      }
      finished.current = true;
      onFinishRef.current?.();
    };

    const hold = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished: done }) => {
        if (done) {
          finish();
        }
      });
    }, 1200);

    const fallback = setTimeout(finish, 2800);
    return () => {
      clearTimeout(hold);
      clearTimeout(fallback);
    };
  }, [onFinish, opacity]);

  return (
    <View style={styles.screen}>
      <Animated.Image
        source={brandHero}
        resizeMode="contain"
        style={{ width: size, height: size, opacity }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
