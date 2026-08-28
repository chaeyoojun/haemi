import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { FORM_MAX_WIDTH, useWideLayout } from '@/lib/layout';

const BEST_KEY = 'haemi.game.best';
const ORANGE = '#F07D22';
const SKY = '#D9EEF8';
const GROUND_COLOR = '#F4E1C8';
const GATE_COLOR = '#2C2C2C';

type Phase = 'ready' | 'play' | 'dead';

type Gate = {
  id: number;
  x: number;
  gapY: number;
  scored: boolean;
};

type World = {
  phase: Phase;
  y: number;
  vy: number;
  gates: Gate[];
  score: number;
  nextId: number;
  spawnIn: number;
};

const START_Y = 0.45;
const JUMP = -0.2;
const GRAVITY = 0.011;
const DRONE_X = 0.2;
const DRONE_W = 0.08;
const DRONE_H = 0.05;
const GATE_W = 0.11;
const GROUND = 0.88;
const CEILING = 0.03;

function freshWorld(): World {
  return {
    phase: 'ready',
    y: START_Y,
    vy: 0,
    gates: [],
    score: 0,
    nextId: 1,
    spawnIn: 0,
  };
}

export function GateGame() {
  const palette = Colors[useColorScheme()];
  const wide = useWideLayout();
  const { height: windowHeight } = useWindowDimensions();
  const [best, setBest] = useState(0);
  const [world, setWorld] = useState<World>(freshWorld);
  const [box, setBox] = useState({ w: 360, h: 480 });
  const worldRef = useRef(world);
  const bestRef = useRef(0);
  const frameRef = useRef(0);
  const lastRef = useRef(0);
  const playingRef = useRef(false);

  worldRef.current = world;
  bestRef.current = best;

  useEffect(() => {
    AsyncStorage.getItem(BEST_KEY)
      .then((value) => {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) {
          setBest(n);
          bestRef.current = n;
        }
      })
      .catch(() => undefined);
  }, []);

  const stop = useCallback(() => {
    playingRef.current = false;
    lastRef.current = 0;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
  }, []);

  const tick = useCallback((now: number) => {
    if (!playingRef.current) {
      return;
    }
    const prev = lastRef.current || now;
    lastRef.current = now;
    const dt = Math.min(2.2, (now - prev) / 16.67);
    const w = worldRef.current;
    if (w.phase !== 'play') {
      return;
    }

    const gap = Math.max(0.3, 0.4 - w.score * 0.005);
    const speed = Math.min(0.011, 0.0065 + w.score * 0.00025);
    w.vy += GRAVITY * dt;
    w.y += w.vy * dt;

    w.spawnIn -= dt;
    if (w.spawnIn <= 0) {
      w.gates.push({
        id: w.nextId,
        x: 1.12,
        gapY: 0.18 + Math.random() * 0.36,
        scored: false,
      });
      w.nextId += 1;
      w.spawnIn = 78;
    }

    let hit = w.y < CEILING || w.y + DRONE_H > GROUND;
    const nextGates: Gate[] = [];
    for (const gate of w.gates) {
      gate.x -= speed * dt;
      if (gate.x < -0.25) {
        continue;
      }
      if (!gate.scored && gate.x + GATE_W < DRONE_X) {
        gate.scored = true;
        w.score += 1;
      }
      const overlapX = DRONE_X + DRONE_W > gate.x && DRONE_X < gate.x + GATE_W;
      const inGap = w.y > gate.gapY && w.y + DRONE_H < gate.gapY + gap;
      if (overlapX && !inGap) {
        hit = true;
      }
      nextGates.push({ ...gate });
    }
    w.gates = nextGates;

    if (hit) {
      w.phase = 'dead';
      w.vy = 0;
      playingRef.current = false;
      frameRef.current = 0;
      if (w.score > bestRef.current) {
        bestRef.current = w.score;
        setBest(w.score);
        AsyncStorage.setItem(BEST_KEY, String(w.score)).catch(() => undefined);
      }
      setWorld({ ...w, gates: w.gates.map((gate) => ({ ...gate })) });
      return;
    }

    setWorld({
      phase: w.phase,
      y: w.y,
      vy: w.vy,
      gates: w.gates.map((gate) => ({ ...gate })),
      score: w.score,
      nextId: w.nextId,
      spawnIn: w.spawnIn,
    });
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const flap = useCallback(() => {
    const w = worldRef.current;
    if (w.phase === 'dead') {
      return;
    }
    if (w.phase === 'ready') {
      const next = freshWorld();
      next.phase = 'play';
      next.y = START_Y;
      next.vy = JUMP;
      next.spawnIn = 36;
      worldRef.current = next;
      setWorld(next);
      playingRef.current = true;
      lastRef.current = 0;
      frameRef.current = requestAnimationFrame(tick);
      return;
    }
    w.vy = JUMP;
  }, [tick]);

  const restart = useCallback(() => {
    stop();
    const next = freshWorld();
    worldRef.current = next;
    setWorld(next);
  }, [stop]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        stop();
        const next = freshWorld();
        worldRef.current = next;
        setWorld(next);
      };
    }, [stop])
  );

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        flap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flap]);

  const playH = Math.max(340, Math.min(windowHeight - (wide ? 180 : 220), 640));
  const gap = Math.max(0.3, 0.4 - world.score * 0.005);
  const tilt = Math.max(-18, Math.min(24, world.vy * 70));

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={[styles.wrap, wide ? styles.wrapWide : null]}>
        <View style={styles.hud}>
          <Text style={[styles.score, { color: palette.text }]}>{world.score}</Text>
          <Text style={[styles.best, { color: palette.muted }]}>최고 {best}</Text>
        </View>
        <View
          style={[styles.stage, { height: playH, backgroundColor: SKY }]}
          onLayout={(event) => {
            const next = event.nativeEvent.layout;
            if (next.width > 8 && next.height > 8) {
              setBox({ w: next.width, h: next.height });
            }
          }}>
          {world.gates.map((gate) => {
            const left = gate.x * box.w;
            const gapTop = gate.gapY * box.h;
            const gapH = gap * box.h;
            const groundY = GROUND * box.h;
            return (
              <View key={gate.id} pointerEvents="none">
                <View style={[styles.pole, { left, top: 0, width: GATE_W * box.w, height: Math.max(8, gapTop) }]} />
                <View style={[styles.rim, { left, top: Math.max(0, gapTop - 8), width: GATE_W * box.w }]} />
                <View style={[styles.rim, { left, top: gapTop + gapH - 6, width: GATE_W * box.w }]} />
                <View
                  style={[
                    styles.pole,
                    {
                      left,
                      top: gapTop + gapH,
                      width: GATE_W * box.w,
                      height: Math.max(8, groundY - (gapTop + gapH)),
                    },
                  ]}
                />
              </View>
            );
          })}
          <View
            pointerEvents="none"
            style={[
              styles.drone,
              {
                left: DRONE_X * box.w,
                top: world.y * box.h,
                width: Math.max(30, DRONE_W * box.w),
                height: Math.max(18, DRONE_H * box.h),
                transform: [{ rotate: `${tilt}deg` }],
              },
            ]}>
            <View style={styles.rotor} />
            <View style={styles.body} />
            <View style={styles.rotor} />
          </View>
          <View style={[styles.ground, { top: GROUND * box.h, backgroundColor: GROUND_COLOR }]} />
          {world.phase === 'ready' ? (
            <View style={styles.hint} pointerEvents="none">
              <Text style={styles.hintTitle}>게이트</Text>
              <Text style={styles.hintBody}>화면을 눌러 드론을 띄우세요</Text>
            </View>
          ) : null}
          {world.phase === 'dead' ? (
            <View style={styles.overlay}>
              <Text style={styles.hintTitle}>추락</Text>
              <Text style={styles.hintBody}>{world.score}점</Text>
              <Pressable onPress={restart} style={styles.retry} accessibilityRole="button">
                <Text style={styles.retryText}>다시 하기</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPressIn={flap}
              style={styles.hit}
              accessibilityRole="button"
              accessibilityLabel="화면을 눌러 드론을 날리기"
            />
          )}
        </View>
        <Text style={[styles.help, { color: palette.muted }]}>
          {Platform.OS === 'web' ? '클릭 또는 스페이스로 비행' : '탭해서 비행 · 게이트를 통과하세요'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  wrap: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 10 },
  wrapWide: { maxWidth: FORM_MAX_WIDTH, width: '100%', alignSelf: 'center' },
  hud: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  score: { fontSize: 28, fontWeight: '800' },
  best: { fontSize: 14, fontWeight: '600' },
  stage: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D7E7EF',
    position: 'relative',
  },
  hit: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    cursor: 'pointer',
  },
  pole: {
    position: 'absolute',
    backgroundColor: GATE_COLOR,
    borderRadius: 4,
    zIndex: 1,
  },
  rim: {
    position: 'absolute',
    height: 14,
    backgroundColor: ORANGE,
    borderRadius: 7,
    zIndex: 1,
  },
  drone: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  rotor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1A1A1A',
  },
  body: {
    flex: 1,
    height: 12,
    marginHorizontal: 2,
    borderRadius: 6,
    backgroundColor: ORANGE,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  hint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.62)',
    gap: 8,
    padding: 20,
    zIndex: 5,
  },
  hintTitle: { fontSize: 28, fontWeight: '800', color: '#1A1A1A' },
  hintBody: { fontSize: 16, fontWeight: '600', color: '#6B6B6B' },
  retry: {
    marginTop: 8,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  help: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
