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
  const glow = useRef(new Animated.Value(0.4)).current;

  const finish = () => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    onFinishRef.current();
  };

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

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

    pulse.start();

    const hold = setTimeout(() => {
      pulse.stop();
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
      pulse.stop();
      clearTimeout(hold);
      clearTimeout(fallback);
    };
  }, [glow, opacity, scale]);

  return (
    <View style={styles.screen}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: width * 0.7,
            height: width * 0.7,
            backgroundColor: '#F07D22',
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
          },
        ]}
      />
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
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  logo: {
    zIndex: 2,
  },
});
