import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FORM_MAX_WIDTH, useWideLayout } from '@/lib/layout';

const BEST_KEY = 'haemi.game.best';
const ORANGE = '#F07D22';
const SKY_TOP = '#9FD4EE';
const SKY_MID = '#D7EEF8';
const SKY_HORIZON = '#E7F3D8';
const GROUND_DIRT = '#C9A36A';
const GROUND_GRASS = '#7F9E5A';
const CARBON = '#1C1C1C';
const ARM = '#2A2A2A';

type Phase = 'ready' | 'play' | 'dead';

type PickupKind = 'motor' | 'prop' | 'battery';

type Gate = {
  slot: number;
  x: number;
  gapY: number;
  scored: boolean;
};

type Pickup = {
  slot: number;
  kind: PickupKind;
  x: number;
  y: number;
};

type World = {
  phase: Phase;
  y: number;
  vy: number;
  tilt: number;
  gates: Gate[];
  pickups: Pickup[];
  score: number;
  spawnIn: number;
  itemIn: number;
  motorT: number;
  propT: number;
  warm: number;
};

const START_Y = 0.46;
const STEP = 1 / 120;
const GRAVITY = 1.62;
const JUMP = -0.7;
const MAX_FALL = 0.9;
const DRONE_X = 0.17;
const DRONE_W = 0.168;
const DRONE_H = 0.118;
const HIT_W = 0.046;
const HIT_H = 0.034;
const GATE_W = 0.145;
const GROUND = 0.86;
const CEILING = 0.045;
const SLOT_COUNT = 4;
const PICKUP_SLOTS = 3;
const ITEM_R = 0.04;
const BATTERY_SCORE = 8;
const MOTOR_TIME = 4.4;
const PROP_TIME = 4.4;
const KINDS: PickupKind[] = ['motor', 'prop', 'battery'];

function freshWorld(): World {
  return {
    phase: 'ready',
    y: START_Y,
    vy: 0,
    tilt: 0,
    gates: [],
    pickups: [],
    score: 0,
    spawnIn: 0,
    itemIn: 0,
    motorT: 0,
    propT: 0,
    warm: 0,
  };
}

function gapFor(score: number) {
  return Math.max(0.3, 0.4 - score * 0.0055);
}

function speedFor(score: number) {
  return Math.min(0.5, 0.33 + score * 0.01);
}

function clamp(n: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, n));
}

function Prop({
  size,
  spin,
  offset,
  style,
}: {
  size: number;
  spin: SharedValue<number>;
  offset: number;
  style: { left: number; top: number };
}) {
  const blades = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value + offset}deg` }],
  }));
  const disc = size * 0.92;
  const hub = Math.max(7, size * 0.28);

  return (
    <View style={[styles.propWrap, { width: size, height: size, left: style.left, top: style.top }]}>
      <View
        style={[
          styles.propDisc,
          {
            width: disc,
            height: disc,
            borderRadius: disc / 2,
          },
        ]}
      />
      <Animated.View style={[styles.bladeBox, { width: size, height: size }, blades]}>
        <View style={[styles.blade, { top: size * 0.46, width: size * 0.9, height: Math.max(3, size * 0.1) }]} />
        <View
          style={[
            styles.blade,
            { left: size * 0.46, top: size * 0.06, width: Math.max(3, size * 0.1), height: size * 0.88 },
          ]}
        />
      </Animated.View>
      <View
        style={[
          styles.motor,
          {
            width: hub,
            height: hub,
            borderRadius: hub / 2,
          },
        ]}
      />
    </View>
  );
}

function DroneSprite({
  width,
  height,
  left,
  propSpin,
  bodyStyle,
}: {
  width: number;
  height: number;
  left: number;
  propSpin: SharedValue<number>;
  bodyStyle: object;
}) {
  const prop = Math.max(22, width * 0.38);

  return (
    <Animated.View pointerEvents="none" style={[{ width, height, left, top: 0 }, styles.drone, bodyStyle]}>
      <View style={[styles.arm, { top: height * 0.46, width: width * 0.7, transform: [{ rotate: '27deg' }] }]} />
      <View style={[styles.arm, { top: height * 0.46, width: width * 0.7, transform: [{ rotate: '-27deg' }] }]} />
      <Prop size={prop} spin={propSpin} offset={0} style={{ left: width * 0.02, top: height * 0.04 }} />
      <Prop size={prop} spin={propSpin} offset={18} style={{ left: width * 0.58, top: 0 }} />
      <Prop size={prop} spin={propSpin} offset={8} style={{ left: width * 0.02, top: height * 0.52 }} />
      <Prop size={prop} spin={propSpin} offset={28} style={{ left: width * 0.58, top: height * 0.48 }} />
      <View
        style={[
          styles.stack,
          {
            left: width * 0.3,
            top: height * 0.3,
            width: width * 0.34,
            height: height * 0.38,
          },
        ]}>
        <View style={styles.stackStripe} />
      </View>
      <View
        style={[
          styles.camera,
          {
            left: width * 0.6,
            top: height * 0.36,
            width: width * 0.2,
            height: height * 0.26,
          },
        ]}>
        <View style={styles.lens} />
      </View>
      <View style={[styles.tailLed, { left: width * 0.22, top: height * 0.44 }]} />
    </Animated.View>
  );
}

function GateSlot({
  x,
  gapY,
  visible,
  gap,
  boxW,
  boxH,
}: {
  x: SharedValue<number>;
  gapY: SharedValue<number>;
  visible: SharedValue<number>;
  gap: SharedValue<number>;
  boxW: number;
  boxH: number;
}) {
  const width = GATE_W * boxW;
  const frame = Math.max(8, width * 0.16);
  const topCol = useAnimatedStyle(() => ({
    left: x.value * boxW,
    height: Math.max(4, gapY.value * boxH),
    opacity: visible.value,
  }));
  const botCol = useAnimatedStyle(() => ({
    left: x.value * boxW,
    top: gapY.value * boxH + gap.value * boxH,
    height: Math.max(4, GROUND * boxH - (gapY.value * boxH + gap.value * boxH)),
    opacity: visible.value,
  }));
  const topBar = useAnimatedStyle(() => ({
    left: x.value * boxW,
    top: gapY.value * boxH,
    opacity: visible.value,
  }));
  const botBar = useAnimatedStyle(() => ({
    left: x.value * boxW,
    top: gapY.value * boxH + gap.value * boxH - frame,
    opacity: visible.value,
  }));
  const leftBar = useAnimatedStyle(() => ({
    left: x.value * boxW,
    top: gapY.value * boxH,
    height: gap.value * boxH,
    opacity: visible.value,
  }));
  const rightBar = useAnimatedStyle(() => ({
    left: x.value * boxW + width - frame,
    top: gapY.value * boxH,
    height: gap.value * boxH,
    opacity: visible.value,
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.column, { width }, topCol]} />
      <Animated.View pointerEvents="none" style={[styles.column, { width }, botCol]} />
      <Animated.View pointerEvents="none" style={[styles.gateBar, { width, height: frame }, topBar]} />
      <Animated.View pointerEvents="none" style={[styles.gateBar, { width, height: frame }, botBar]} />
      <Animated.View pointerEvents="none" style={[styles.gateBar, { width: frame }, leftBar]} />
      <Animated.View pointerEvents="none" style={[styles.gateBar, { width: frame }, rightBar]} />
    </>
  );
}

function PickupMark({ kind }: { kind: PickupKind }) {
  if (kind === 'motor') {
    return (
      <View style={styles.itemSlot}>
        <View style={styles.motorBell}>
          <View style={styles.motorRing} />
          <View style={styles.motorShaft} />
        </View>
        <View style={styles.motorMount} />
      </View>
    );
  }
  if (kind === 'prop') {
    return (
      <View style={styles.itemSlot}>
        {[20, 110, 200, 290].map((deg) => (
          <View key={deg} style={[styles.propArm, { transform: [{ rotate: `${deg}deg` }] }]}>
            <View style={styles.propBlade} />
          </View>
        ))}
        <View style={styles.propHub}>
          <View style={styles.propNut} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.itemSlot}>
      <View style={styles.battPack}>
        <View style={styles.battStripe} />
        <View style={styles.battLeadRow}>
          <View style={[styles.battLead, { backgroundColor: '#C62828' }]} />
          <View style={[styles.battLead, { backgroundColor: '#1A1A1A' }]} />
        </View>
      </View>
    </View>
  );
}

function PickupSlot({
  x,
  y,
  visible,
  kind,
  boxW,
  boxH,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  visible: SharedValue<number>;
  kind: PickupKind;
  boxW: number;
  boxH: number;
}) {
  const size = Math.max(26, ITEM_R * 2 * boxW);
  const style = useAnimatedStyle(() => ({
    left: x.value * boxW - size / 2,
    top: y.value * boxH - size / 2,
    opacity: visible.value,
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, styles.pickup, style]}>
      <PickupMark kind={kind} />
    </Animated.View>
  );
}

function DriftCloud({
  offset,
  idle,
  play,
  boxW,
  top,
  width,
}: {
  offset: number;
  idle: SharedValue<number>;
  play: SharedValue<number>;
  boxW: number;
  top: number;
  width: number;
}) {
  const style = useAnimatedStyle(() => {
    const t = (offset + idle.value + play.value) % 1.45;
    return { left: (t - 0.22) * boxW };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.cloud, { top, width, height: width * 0.34 }, style]} />
  );
}

export function GateGame() {
  const palette = Colors[useColorScheme()];
  const router = useRouter();
  const { displayName } = useAuth();
  const wide = useWideLayout();
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [pickupKinds, setPickupKinds] = useState<PickupKind[]>(['motor', 'prop', 'battery']);
  const [motorOn, setMotorOn] = useState(false);
  const [propOn, setPropOn] = useState(false);
  const [toast, setToast] = useState('');
  const [box, setBox] = useState({ w: 320, h: 420 });

  const worldRef = useRef<World>(freshWorld());
  const bestRef = useRef(0);
  const frameRef = useRef(0);
  const lastRef = useRef(0);
  const accRef = useRef(0);
  const playingRef = useRef(false);

  const droneY = useSharedValue(START_Y);
  const droneTilt = useSharedValue(0);
  const droneScale = useSharedValue(1);
  const hover = useSharedValue(0);
  const propSpin = useSharedValue(0);
  const cloudIdle = useSharedValue(0);
  const cloudPlay = useSharedValue(0);
  const scorePop = useSharedValue(1);
  const gapSv = useSharedValue(gapFor(0));
  const slotX0 = useSharedValue(2);
  const slotX1 = useSharedValue(2);
  const slotX2 = useSharedValue(2);
  const slotX3 = useSharedValue(2);
  const slotGap0 = useSharedValue(0.3);
  const slotGap1 = useSharedValue(0.3);
  const slotGap2 = useSharedValue(0.3);
  const slotGap3 = useSharedValue(0.3);
  const slotOn0 = useSharedValue(0);
  const slotOn1 = useSharedValue(0);
  const slotOn2 = useSharedValue(0);
  const slotOn3 = useSharedValue(0);
  const pickX0 = useSharedValue(2);
  const pickX1 = useSharedValue(2);
  const pickX2 = useSharedValue(2);
  const pickY0 = useSharedValue(0.4);
  const pickY1 = useSharedValue(0.4);
  const pickY2 = useSharedValue(0.4);
  const pickOn0 = useSharedValue(0);
  const pickOn1 = useSharedValue(0);
  const pickOn2 = useSharedValue(0);

  const visuals = useRef({
    droneY,
    droneTilt,
    droneScale,
    hover,
    cloudPlay,
    gapSv,
    scorePop,
    slotX: [slotX0, slotX1, slotX2, slotX3],
    slotGap: [slotGap0, slotGap1, slotGap2, slotGap3],
    slotOn: [slotOn0, slotOn1, slotOn2, slotOn3],
    pickX: [pickX0, pickX1, pickX2],
    pickY: [pickY0, pickY1, pickY2],
    pickOn: [pickOn0, pickOn1, pickOn2],
  }).current;

  const hideSlots = useCallback(() => {
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      visuals.slotOn[i].value = 0;
      visuals.slotX[i].value = 2;
    }
    for (let i = 0; i < PICKUP_SLOTS; i += 1) {
      visuals.pickOn[i].value = 0;
      visuals.pickX[i].value = 2;
    }
  }, [visuals]);

  const stopLoop = useCallback(() => {
    playingRef.current = false;
    lastRef.current = 0;
    accRef.current = 0;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
  }, []);

  const startHover = useCallback(() => {
    visuals.hover.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [visuals]);

  const die = useCallback(
    (w: World) => {
      w.phase = 'dead';
      w.vy = 0;
      w.motorT = 0;
      w.propT = 0;
      stopLoop();
      cancelAnimation(visuals.hover);
      visuals.hover.value = 0;
      visuals.droneScale.value = withTiming(0.88, { duration: 160 });
      setPhase('dead');
      setMotorOn(false);
      setPropOn(false);
      if (w.score > bestRef.current) {
        bestRef.current = w.score;
        setBest(w.score);
        AsyncStorage.setItem(BEST_KEY, String(w.score)).catch(() => undefined);
      }
      if (w.score >= 1 && displayName) {
        api.create('/api/game/scores', { score: w.score }).catch(() => undefined);
      }
    },
    [displayName, stopLoop, visuals]
  );

  const integrate = useCallback(
    (dt: number) => {
      const w = worldRef.current;
      if (w.motorT > 0) {
        w.motorT = Math.max(0, w.motorT - dt);
        if (w.motorT <= 0) {
          setMotorOn(false);
        }
      }
      if (w.propT > 0) {
        w.propT = Math.max(0, w.propT - dt);
        if (w.propT <= 0) {
          setPropOn(false);
        }
      }

      const grav = GRAVITY * (w.propT > 0 ? 0.45 : 1);
      const fallCap = MAX_FALL * (w.propT > 0 ? 0.55 : 1);
      w.vy = Math.min(fallCap, w.vy + grav * dt);
      w.y += w.vy * dt;
      if (w.y < CEILING) {
        w.y = CEILING;
        w.vy = Math.max(0, w.vy);
      }

      const wantTilt = clamp(w.vy * 28, -20, 26);
      w.tilt += (wantTilt - w.tilt) * Math.min(1, dt * 10);

      const gap = gapFor(w.score);
      const speed = speedFor(w.score) * (w.motorT > 0 ? 1.55 : 1);
      visuals.gapSv.value = gap;
      visuals.cloudPlay.value += speed * 0.22 * dt;
      w.spawnIn -= dt;
      if (w.spawnIn <= 0 && w.gates.length < SLOT_COUNT) {
        const used = new Set(w.gates.map((gate) => gate.slot));
        let slot = 0;
        while (used.has(slot) && slot < SLOT_COUNT) {
          slot += 1;
        }
        if (slot < SLOT_COUNT) {
          const gapY = 0.15 + Math.random() * 0.3;
          w.gates.push({ slot, x: 1.12, gapY, scored: false });
          visuals.slotGap[slot].value = gapY;
          visuals.slotX[slot].value = 1.12;
          visuals.slotOn[slot].value = 1;
          w.spawnIn = 1.42;
        }
      }

      w.itemIn -= dt;
      if (w.itemIn <= 0 && w.pickups.length < PICKUP_SLOTS) {
        const used = new Set(w.pickups.map((item) => item.slot));
        let slot = 0;
        while (used.has(slot) && slot < PICKUP_SLOTS) {
          slot += 1;
        }
        if (slot < PICKUP_SLOTS) {
          const kind = KINDS[Math.floor(Math.random() * KINDS.length)] ?? 'battery';
          const lastGate = w.gates[w.gates.length - 1];
          const y = lastGate
            ? lastGate.gapY + gap * 0.28 + Math.random() * gap * 0.38
            : 0.22 + Math.random() * 0.42;
          w.pickups.push({ slot, kind, x: 1.22, y });
          visuals.pickX[slot].value = 1.22;
          visuals.pickY[slot].value = y;
          visuals.pickOn[slot].value = 1;
          setPickupKinds((prev) => {
            const next = [...prev];
            next[slot] = kind;
            return next;
          });
          w.itemIn = 1.85;
        }
      }

      const hitX = DRONE_X + (DRONE_W - HIT_W) * 0.5;
      const hitY = w.y + (DRONE_H - HIT_H) * 0.5;
      const hitCx = hitX + HIT_W * 0.5;
      const hitCy = hitY + HIT_H * 0.5;
      let crashed = hitY + HIT_H > GROUND;
      const next: Gate[] = [];
      for (const gate of w.gates) {
        gate.x -= speed * dt;
        visuals.slotX[gate.slot].value = gate.x;
        if (gate.x < -0.3) {
          visuals.slotOn[gate.slot].value = 0;
          visuals.slotX[gate.slot].value = 2;
          continue;
        }
        if (!gate.scored && gate.x + GATE_W < hitX) {
          gate.scored = true;
          w.score += 1;
          setScore(w.score);
          visuals.scorePop.value = withSequence(
            withTiming(1.16, { duration: 90 }),
            withTiming(1, { duration: 140 })
          );
        }
        const overlapX = hitX + HIT_W > gate.x && hitX < gate.x + GATE_W;
        const inGap = hitY > gate.gapY && hitY + HIT_H < gate.gapY + gap;
        if (w.warm <= 0 && overlapX && !inGap) {
          crashed = true;
        }
        next.push(gate);
      }
      w.gates = next;

      const kept: Pickup[] = [];
      for (const item of w.pickups) {
        item.x -= speed * dt;
        visuals.pickX[item.slot].value = item.x;
        visuals.pickY[item.slot].value = item.y;
        if (item.x < -0.2) {
          visuals.pickOn[item.slot].value = 0;
          visuals.pickX[item.slot].value = 2;
          continue;
        }
        const dx = hitCx - item.x;
        const dy = hitCy - item.y;
        if (dx * dx + dy * dy < (ITEM_R + 0.03) * (ITEM_R + 0.03)) {
          visuals.pickOn[item.slot].value = 0;
          visuals.pickX[item.slot].value = 2;
          if (item.kind === 'motor') {
            w.motorT = MOTOR_TIME;
            setMotorOn(true);
            setToast('모터 · 전진 가속');
          } else if (item.kind === 'prop') {
            w.propT = PROP_TIME;
            setPropOn(true);
            setToast('프로펠러 · 낙하 완화');
          } else {
            w.score += BATTERY_SCORE;
            setScore(w.score);
            setToast(`배터리 · +${BATTERY_SCORE}점`);
            visuals.scorePop.value = withSequence(
              withTiming(1.2, { duration: 90 }),
              withTiming(1, { duration: 140 })
            );
          }
          continue;
        }
        kept.push(item);
      }
      w.pickups = kept;
      if (w.warm > 0) {
        w.warm -= dt;
      }

      visuals.droneY.value = w.y;
      visuals.droneTilt.value = w.tilt;

      if (w.warm <= 0 && crashed) {
        die(w);
      }
    },
    [die, visuals]
  );

  const step = useCallback(
    (now: number) => {
      if (!playingRef.current) {
        return;
      }
      const w = worldRef.current;
      if (w.phase !== 'play') {
        return;
      }
      if (!lastRef.current) {
        lastRef.current = now;
        return;
      }
      accRef.current += Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      let n = 0;
      while (accRef.current >= STEP && n < 8) {
        integrate(STEP);
        accRef.current -= STEP;
        n += 1;
      }
    },
    [integrate]
  );

  const startLoop = useCallback(() => {
    if (frameRef.current) {
      return;
    }
    const loop = (now: number) => {
      step(now);
      if (playingRef.current) {
        frameRef.current = requestAnimationFrame(loop);
      } else {
        frameRef.current = 0;
      }
    };
    frameRef.current = requestAnimationFrame(loop);
  }, [step]);

  const flap = useCallback(() => {
    const w = worldRef.current;
    if (w.phase === 'dead') {
      return;
    }
    if (w.phase === 'ready') {
      w.phase = 'play';
      w.y = START_Y;
      w.vy = JUMP;
      w.tilt = -12;
      w.gates = [];
      w.pickups = [];
      w.score = 0;
      w.spawnIn = 0.95;
      w.itemIn = 1.1;
      w.motorT = 0;
      w.propT = 0;
      w.warm = 0.28;
      hideSlots();
      cancelAnimation(visuals.hover);
      visuals.hover.value = 0;
      visuals.droneY.value = START_Y;
      visuals.droneTilt.value = -12;
      visuals.droneScale.value = 1;
      visuals.cloudPlay.value = 0;
      visuals.gapSv.value = gapFor(0);
      worldRef.current = w;
      setPhase('play');
      setScore(0);
      setMotorOn(false);
      setPropOn(false);
      setToast('');
      playingRef.current = true;
      lastRef.current = 0;
      accRef.current = 0;
      startLoop();
      return;
    }
    w.vy = JUMP;
  }, [hideSlots, startLoop, visuals]);

  const restart = useCallback(() => {
    stopLoop();
    const next = freshWorld();
    worldRef.current = next;
    hideSlots();
    visuals.droneY.value = START_Y;
    visuals.droneTilt.value = 0;
    visuals.droneScale.value = 1;
    visuals.cloudPlay.value = 0;
    visuals.gapSv.value = gapFor(0);
    startHover();
    setPhase('ready');
    setScore(0);
    setMotorOn(false);
    setPropOn(false);
    setToast('');
  }, [hideSlots, startHover, stopLoop, visuals]);

  useFocusEffect(
    useCallback(() => {
      if (worldRef.current.phase === 'play') {
        playingRef.current = true;
        lastRef.current = 0;
        startLoop();
      }
      return () => stopLoop();
    }, [startLoop, stopLoop])
  );

  useEffect(() => {
    propSpin.value = withRepeat(withTiming(360, { duration: 220, easing: Easing.linear }), -1, false);
    cloudIdle.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.linear }), -1, false);
    startHover();
    return () => {
      cancelAnimation(propSpin);
      cancelAnimation(cloudIdle);
      cancelAnimation(hover);
      stopLoop();
    };
  }, [cloudIdle, hover, propSpin, startHover, stopLoop]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(''), 1400);
    return () => clearTimeout(timer);
  }, [toast]);

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

  const droneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (droneY.value + hover.value * 0.018) * box.h },
      { rotate: `${droneTilt.value}deg` },
      { scale: droneScale.value },
    ],
  }));
  const shadowStyle = useAnimatedStyle(() => {
    const lift = Math.max(0, GROUND - (droneY.value + DRONE_H));
    const scale = clamp(1.15 - lift * 1.8, 0.45, 1.15);
    return {
      top: GROUND * box.h - 7,
      opacity: 0.16 + (1 - lift) * 0.18,
      transform: [{ scaleX: scale }],
    };
  });
  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scorePop.value }],
  }));

  const droneW = Math.max(56, DRONE_W * box.w);
  const droneH = Math.max(40, DRONE_H * box.h);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={[styles.wrap, wide ? styles.wrapWide : null]}>
        <View style={styles.stageWrap}>
          <Pressable
            collapsable={false}
            disabled={phase === 'dead'}
            onPressIn={flap}
            accessibilityRole="button"
            accessibilityLabel="화면을 눌러 드론을 날리기"
            style={[styles.stage, Platform.OS === 'web' ? styles.webHit : null]}
            onLayout={(event) => {
              const next = event.nativeEvent.layout;
              if (next.width > 8 && next.height > 8) {
                setBox({ w: next.width, h: next.height });
              }
            }}>
            <View pointerEvents="none" style={[styles.skyTop, { height: box.h * 0.42, backgroundColor: SKY_TOP }]} />
            <View pointerEvents="none" style={[styles.skyMid, { top: box.h * 0.3, height: box.h * 0.4, backgroundColor: SKY_MID }]} />
            <View
              pointerEvents="none"
              style={[styles.horizon, { top: box.h * 0.62, height: GROUND * box.h - box.h * 0.62, backgroundColor: SKY_HORIZON }]}
            />
            <DriftCloud offset={0.05} idle={cloudIdle} play={cloudPlay} boxW={box.w} top={box.h * 0.08} width={92} />
            <DriftCloud offset={0.48} idle={cloudIdle} play={cloudPlay} boxW={box.w} top={box.h * 0.16} width={70} />
            <DriftCloud offset={0.92} idle={cloudIdle} play={cloudPlay} boxW={box.w} top={box.h * 0.22} width={110} />
            <GateSlot x={slotX0} gapY={slotGap0} visible={slotOn0} gap={gapSv} boxW={box.w} boxH={box.h} />
            <GateSlot x={slotX1} gapY={slotGap1} visible={slotOn1} gap={gapSv} boxW={box.w} boxH={box.h} />
            <GateSlot x={slotX2} gapY={slotGap2} visible={slotOn2} gap={gapSv} boxW={box.w} boxH={box.h} />
            <GateSlot x={slotX3} gapY={slotGap3} visible={slotOn3} gap={gapSv} boxW={box.w} boxH={box.h} />
            <PickupSlot x={pickX0} y={pickY0} visible={pickOn0} kind={pickupKinds[0] ?? 'motor'} boxW={box.w} boxH={box.h} />
            <PickupSlot x={pickX1} y={pickY1} visible={pickOn1} kind={pickupKinds[1] ?? 'prop'} boxW={box.w} boxH={box.h} />
            <PickupSlot x={pickX2} y={pickY2} visible={pickOn2} kind={pickupKinds[2] ?? 'battery'} boxW={box.w} boxH={box.h} />
            <Animated.View
              pointerEvents="none"
              style={[styles.shadow, { left: DRONE_X * box.w + droneW * 0.18, width: droneW * 0.64 }, shadowStyle]}
            />
            <DroneSprite
              width={droneW}
              height={droneH}
              left={DRONE_X * box.w}
              propSpin={propSpin}
              bodyStyle={droneStyle}
            />
            <View pointerEvents="none" style={[styles.grass, { top: GROUND * box.h - 10 }]} />
            <View pointerEvents="none" style={[styles.ground, { top: GROUND * box.h, backgroundColor: GROUND_DIRT }]} />
            <View style={styles.hud} pointerEvents="none">
              <View>
                <Animated.Text style={[styles.score, scoreStyle]}>{score}</Animated.Text>
                <Text style={styles.best}>최고 {best}</Text>
                {motorOn || propOn ? (
                  <View style={styles.buffRow}>
                    {motorOn ? (
                      <View style={styles.buffMotor}>
                        <Text style={styles.buffText}>모터</Text>
                      </View>
                    ) : null}
                    {propOn ? (
                      <View style={styles.buffProp}>
                        <Text style={styles.buffText}>프로펠러</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {toast ? <Text style={styles.toast}>{toast}</Text> : null}
              </View>
            </View>
          </Pressable>
          {phase === 'ready' ? (
            <Pressable
              onPressIn={flap}
              style={styles.readyHit}
              accessibilityRole="button"
              accessibilityLabel="시작">
              <View style={styles.readyCard}>
                <Text style={styles.hintTitle}>게이트</Text>
                <Text style={styles.hintBody}>탭해서 드론을 띄우고 주황 게이트를 통과하세요</Text>
                <View style={styles.retry}>
                  <Text style={styles.retryText}>시작</Text>
                </View>
              </View>
            </Pressable>
          ) : null}
          {phase === 'dead' ? (
            <View style={styles.overlay} pointerEvents="box-none">
              <Text style={styles.hintTitle}>추락</Text>
              <Text style={styles.hintBody}>{score}점</Text>
              <Pressable onPress={restart} style={styles.retry} accessibilityRole="button">
                <Text style={styles.retryText}>다시 하기</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable
            onPress={() => router.push('/game/ranks')}
            style={styles.rankBtn}
            accessibilityRole="button"
            accessibilityLabel="랭킹">
            <Text style={styles.rankBtnText}>랭킹</Text>
          </Pressable>
        </View>
        <View style={styles.guide}>
          <View style={styles.guideItem}>
            <PickupMark kind="motor" />
            <Text style={styles.guideName} numberOfLines={1}>
              모터
            </Text>
            <Text style={[styles.guideDesc, { color: palette.muted }]} numberOfLines={1}>
              전진 가속
            </Text>
          </View>
          <View style={styles.guideItem}>
            <PickupMark kind="prop" />
            <Text style={styles.guideName} numberOfLines={1}>
              프로펠러
            </Text>
            <Text style={[styles.guideDesc, { color: palette.muted }]} numberOfLines={1}>
              낙하 완화
            </Text>
          </View>
          <View style={styles.guideItem}>
            <PickupMark kind="battery" />
            <Text style={styles.guideName} numberOfLines={1}>
              배터리
            </Text>
            <Text style={[styles.guideDesc, { color: palette.muted }]} numberOfLines={1}>
              +{BATTERY_SCORE}점
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  wrap: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6, gap: 6 },
  wrapWide: { maxWidth: FORM_MAX_WIDTH, width: '100%', alignSelf: 'center' },
  stageWrap: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
  },
  stage: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D7E7EF',
    backgroundColor: SKY_MID,
  },
  webHit: {
    cursor: 'pointer',
  },
  skyTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  skyMid: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  cloud: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 20,
  },
  column: {
    position: 'absolute',
    backgroundColor: '#2A3340',
  },
  gateBar: {
    position: 'absolute',
    backgroundColor: ORANGE,
    borderRadius: 3,
    zIndex: 1,
  },
  drone: {
    position: 'absolute',
    zIndex: 3,
  },
  arm: {
    position: 'absolute',
    left: '15%',
    height: 5,
    backgroundColor: ARM,
    borderRadius: 2,
  },
  propWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  propDisc: {
    position: 'absolute',
    backgroundColor: 'rgba(20,20,20,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  bladeBox: {
    position: 'absolute',
  },
  blade: {
    position: 'absolute',
    left: '5%',
    backgroundColor: 'rgba(36,36,36,0.55)',
    borderRadius: 2,
  },
  motor: {
    backgroundColor: CARBON,
    borderWidth: 2,
    borderColor: ORANGE,
    zIndex: 3,
  },
  stack: {
    position: 'absolute',
    backgroundColor: CARBON,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#3A3A3A',
    zIndex: 4,
    overflow: 'hidden',
  },
  stackStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '38%',
    height: '26%',
    backgroundColor: ORANGE,
  },
  camera: {
    position: 'absolute',
    backgroundColor: '#111111',
    borderRadius: 5,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lens: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5B8CFF',
  },
  tailLed: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
    zIndex: 5,
  },
  shadow: {
    position: 'absolute',
    height: 8,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    zIndex: 2,
  },
  grass: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: GROUND_GRASS,
    zIndex: 1,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  hud: {
    position: 'absolute',
    left: 14,
    top: 10,
    zIndex: 6,
    maxWidth: '46%',
  },
  score: { fontSize: 34, fontWeight: '800', color: '#1A1A1A' },
  best: { fontSize: 13, fontWeight: '700', color: '#4D4D4D' },
  buffRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  buffMotor: {
    backgroundColor: ORANGE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  buffProp: {
    backgroundColor: '#2A3340',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  buffText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  toast: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  rankBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 8,
  },
  rankBtnText: { fontSize: 13, fontWeight: '800', color: '#F07D22' },
  pickup: {
    position: 'absolute',
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemSlot: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motorBell: {
    width: 16,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#5C6168',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  motorRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: ORANGE,
  },
  motorShaft: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1A1A1A',
  },
  motorMount: {
    marginTop: 1,
    width: 12,
    height: 3,
    borderRadius: 1,
    backgroundColor: '#2A2A2A',
  },
  propArm: {
    position: 'absolute',
    width: 26,
    height: 26,
    alignItems: 'center',
  },
  propBlade: {
    width: 6,
    height: 11,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
    backgroundColor: '#3A434D',
    marginTop: 1,
  },
  propHub: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F07D22',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  propNut: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#1A1A1A',
  },
  battPack: {
    width: 22,
    height: 15,
    borderRadius: 3,
    backgroundColor: '#F0C84A',
    borderWidth: 1,
    borderColor: '#C9A126',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  battStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 5,
    height: 4,
    backgroundColor: '#1A1A1A',
  },
  battLeadRow: {
    flexDirection: 'row',
    gap: 3,
  },
  battLead: {
    width: 5,
    height: 4,
    borderRadius: 1,
  },
  readyHit: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14,
  },
  readyCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.58)',
    gap: 8,
    padding: 20,
  },
  hintTitle: { fontSize: 26, fontWeight: '800', color: '#1A1A1A' },
  hintBody: { fontSize: 14, fontWeight: '600', color: '#6B6B6B', textAlign: 'center' },
  retry: {
    marginTop: 6,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  guide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  guideItem: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    minWidth: 0,
  },
  guideName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 14,
    includeFontPadding: false,
  },
  guideDesc: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
    includeFontPadding: false,
  },
});
