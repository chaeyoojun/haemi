import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

const logo = require('../assets/images/opening-logo.png');

type Props = {
  onFinish: () => void;
};

export function BrandSplash({ onFinish }: Props) {
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const { width } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  const finish = () => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    onFinishRef.current();
  };

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 58,
        useNativeDriver: true,
      }),
    ]).start();

    const hold = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished: done }) => {
        if (done) {
          finish();
        }
      });
    }, 2800);

    const fallback = setTimeout(finish, 5000);

    return () => {
      clearTimeout(hold);
      clearTimeout(fallback);
    };
  }, [opacity, scale]);

  return (
    <View style={styles.screen}>
      <Animated.Image
        source={logo}
        resizeMode="contain"
        style={[
          styles.logo,
          {
            width: width * 0.78,
            height: width * 0.42,
            opacity,
            transform: [{ scale }],
          },
        ]}
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
  logo: {
    zIndex: 2,
  },
});
