// app/settings/about.js
//
// About screen + hidden easter egg: tap the logo 4 times within ~1.5s
// of each other and you'll get a three-phase visual effect:
//
//   Phase 1 — Fizzle  (0–900ms):   500 grey particles pop into existence
//                                  at random points across the entire
//                                  screen with a slight bounce — the
//                                  screen reads as completely covered in
//                                  dust.
//   Phase 2 — Hold    (900–2400ms): everyone visible for ~1.5 seconds —
//                                  you have time to register the mess.
//   Phase 3 — Vacuum  (2400–4000ms): every particle accelerates toward
//                                  the logo along its own CURVED path
//                                  (quadratic Bezier with a random
//                                  perpendicular offset), with a small
//                                  per-particle delay so they arrive in
//                                  waves — reads as a whirlwind/vortex
//                                  rather than uniform collapse.
//
// Visual variety per particle:
//   - Size: 3–12px
//   - Tone: 60% slate inkSoft, 40% medium muted
//   - Peak opacity: 0.5–0.95
//   - Curve: ±40% perpendicular offset of straight-line distance
//   - Vacuum delay: 0–300ms after Phase 3 starts
//
// The logo itself reacts: contracts at vacuum start (anticipation,
// "inhale"), expands as particles arrive (absorbing), settles back. A
// brief haptic fires on trigger.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Linking, Alert, Modal,
  Animated, Dimensions, Vibration, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import BrandMark from '../../components/BrandMark';
const VERSION = Constants.expoConfig?.version || '1.0.0';
const PRIVACY_URL = 'https://thefilterlist.app/privacy';
const SUPPORT_URL = 'https://thefilterlist.app';
// Easter egg config — tweak any of these to taste.
const TAP_THRESHOLD            = 4;
const TAP_RESET_MS             = 1500;
const PARTICLE_COUNT           = 700;    // screen feels packed
const FIZZLE_DURATION_MS       = 400;    // each particle's pop-in time
const FIZZLE_MAX_DELAY_MS      = 500;    // organic trickle-in stagger
const VACUUM_START_MS          = 2400;   // long hold before the suck
const VACUUM_DURATION_MS       = 1300;   // base suck duration
const VACUUM_MAX_DELAY_MS      = 300;    // per-particle suck stagger
const LOGO_PULSE_START_MS      = 2200;   // logo contracts just before vacuum
const COOLDOWN_MS              = 6200;   // re-trigger lockout
const PARTICLE_MIN_SIZE        = 3;
const PARTICLE_MAX_SIZE        = 12;
const PARTICLE_MIN_OPACITY     = 0.5;
const PARTICLE_MAX_OPACITY     = 0.95;
const SWIRL_MAX_FACTOR         = 0.4;    // ±40% perpendicular curve offset
const BEZIER_STEPS             = 14;     // path resolution; 12-16 is smooth
// Approximate logo center on screen — safe area top + head row + body
// margin + half of the logo box ≈ 150 on every supported iPhone.
const LOGO_TARGET_Y = 150;
// ----- Particle -----
//
// Lives through three phases:
//   1. Fizzles in at (startX, startY) with a slight scale overshoot.
//   2. Holds at that spot.
//   3. Travels along a CURVED quadratic Bezier path to (targetX,
//      targetY), shrinks, and fades.
//
// The curve is defined by a control point offset perpendicular to the
// straight line from start to target. The offset's sign and magnitude
// (passed as swirlFactor in [-SWIRL_MAX_FACTOR, +SWIRL_MAX_FACTOR]) give
// each particle a unique arc. Combined across 500 particles, this
// reads as a whirlwind rather than a synchronized box-shape collapse.
//
// Path interpolation is precomputed as keyframes (BEZIER_STEPS + 1
// samples) and driven by a single progress Animated.Value that runs
// 0→1 on the native driver — so the curve actually animates at 60fps
// without JS per frame.
function Particle({
  startX, startY, targetX, targetY,
  fizzleDelay, vacuumDelay, size, color, peakOpacity, swirlFactor,
}) {
  const halfSize = size / 2;
  const progress = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  const sc = useRef(new Animated.Value(0)).current;
  // Precompute the Bezier path. useMemo locks it once on mount.
  const { txRange, tyRange, inputRange } = useMemo(() => {
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    // Perpendicular unit vector (rotate (dx,dy) by 90°).
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const offset = swirlFactor * dist;
    const controlX = (startX + targetX) / 2 + perpX * offset;
    const controlY = (startY + targetY) / 2 + perpY * offset;
    const input = [];
    const xs = [];
    const ys = [];
    for (let i = 0; i <= BEZIER_STEPS; i++) {
      const t = i / BEZIER_STEPS;
      const omt = 1 - t;
      // Quadratic Bezier: B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
      const x = omt * omt * startX + 2 * omt * t * controlX + t * t * targetX;
      const y = omt * omt * startY + 2 * omt * t * controlY + t * t * targetY;
      input.push(t);
      xs.push(x - halfSize);
      ys.push(y - halfSize);
    }
    return { txRange: xs, tyRange: ys, inputRange: input };
  }, []);
  const tx = progress.interpolate({ inputRange, outputRange: txRange });
  const ty = progress.interpolate({ inputRange, outputRange: tyRange });
  useEffect(() => {
    // Phase 1: Fizzle in (fade + scale with slight overshoot).
    Animated.parallel([
      Animated.timing(op, {
        toValue: peakOpacity,
        duration: FIZZLE_DURATION_MS,
        delay: fizzleDelay,
        useNativeDriver: true,
      }),
      Animated.timing(sc, {
        toValue: 1,
        duration: FIZZLE_DURATION_MS,
        delay: fizzleDelay,
        easing: Easing.back(2),
        useNativeDriver: true,
      }),
    ]).start();
    // Phase 3: Vacuum — staggered per particle so they arrive in waves.
    const vacuumTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(progress, {
          toValue: 1,
          duration: VACUUM_DURATION_MS,
          easing: Easing.in(Easing.cubic), // slow start, fast end = "sucked"
          useNativeDriver: true,
        }),
        Animated.timing(sc, {
          toValue: 0.05,
          duration: VACUUM_DURATION_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        // Fade only in the last 30% of the vacuum.
        Animated.sequence([
          Animated.delay(VACUUM_DURATION_MS * 0.7),
          Animated.timing(op, {
            toValue: 0,
            duration: VACUUM_DURATION_MS * 0.3,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }, VACUUM_START_MS + vacuumDelay);
    return () => clearTimeout(vacuumTimer);
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: op,
        transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
      }}
    />
  );
}
export default function AboutSettings() {
  const t = useTheme();
  const router = useRouter();
  const s = makeStyles(t);
  // Easter egg state
  const tapCount = useRef(0);
  const tapResetTimer = useRef(null);
  const isAnimating = useRef(false);
  const [particles, setParticles] = useState([]);
  const logoScale = useRef(new Animated.Value(1)).current;
  const onLogoTap = () => {
    if (isAnimating.current) return;
    tapCount.current += 1;
    if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
    tapResetTimer.current = setTimeout(() => { tapCount.current = 0; }, TAP_RESET_MS);
    if (tapCount.current >= TAP_THRESHOLD) {
      tapCount.current = 0;
      clearTimeout(tapResetTimer.current);
      tapResetTimer.current = null;
      triggerEasterEgg();
    }
  };
  const triggerEasterEgg = () => {
    isAnimating.current = true;
    Vibration.vibrate(); // brief tactile feedback at trigger
    const dims = Dimensions.get('window');
    const targetX = dims.width / 2;
    const targetY = LOGO_TARGET_Y;
    // Generate dust distributed across the full screen with varied tone,
    // size, opacity, swirl direction/magnitude, and arrival timing — so
    // every particle has its own unique path into the logo.
    const newParticles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: 'p_' + Date.now() + '_' + i,
      startX: Math.random() * dims.width,
      startY: Math.random() * dims.height,
      fizzleDelay: Math.random() * FIZZLE_MAX_DELAY_MS,
      vacuumDelay: Math.random() * VACUUM_MAX_DELAY_MS,
      size: PARTICLE_MIN_SIZE + Math.random() * (PARTICLE_MAX_SIZE - PARTICLE_MIN_SIZE),
      peakOpacity: PARTICLE_MIN_OPACITY + Math.random() * (PARTICLE_MAX_OPACITY - PARTICLE_MIN_OPACITY),
      // ± SWIRL_MAX_FACTOR; random sign = clockwise or counterclockwise arc
      swirlFactor: (Math.random() - 0.5) * 2 * SWIRL_MAX_FACTOR,
      color: Math.random() < 0.6 ? t.inkSoft : t.muted,
      targetX,
      targetY,
    }));
    setParticles(newParticles);
    // Logo choreography: contract just before vacuum, expand as
    // particles arrive, settle back.
    Animated.sequence([
      Animated.delay(LOGO_PULSE_START_MS),
      Animated.timing(logoScale, {
        toValue: 0.92,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1.22,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    // Cleanup — wait for the latest particle (max vacuum delay) to finish
    const cleanupMs = VACUUM_START_MS + VACUUM_MAX_DELAY_MS + VACUUM_DURATION_MS + 200;
    setTimeout(() => setParticles([]), cleanupMs);
    setTimeout(() => { isAnimating.current = false; }, COOLDOWN_MS);
  };
  const openURL = async (url) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('Cannot open', url);
    } catch (e) {
      Alert.alert('Cannot open', String(e?.message || url));
    }
  };
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>
      <View style={s.body}>
        <View style={s.brandBlock}>
          <Pressable onPress={onLogoTap} hitSlop={4}>
            <Animated.View
              style={[s.logoBox, { transform: [{ scale: logoScale }] }]}
            >
              <BrandMark size={54} />
            </Animated.View>
          </Pressable>
          <Text style={s.appName}>The Filter List</Text>
          <Text style={s.version}>Version {VERSION}</Text>
        </View>
        <Text style={s.tagline}>
          Track every device across your Home, Auto, and Work.
        </Text>
        <View style={s.spacer} />
        <Text style={s.label}>LINKS</Text>
        <View>
          <Pressable
            style={({ pressed }) => [s.linkRow, pressed && s.linkRowPressed]}
            onPress={() => openURL(PRIVACY_URL)}
          >
            <Text style={s.linkTxt}>Privacy Policy</Text>
            <Text style={s.linkChev}>{'\u203A'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.linkRow, pressed && s.linkRowPressed]}
            onPress={() => openURL(SUPPORT_URL)}
          >
            <Text style={s.linkTxt}>Support & Website</Text>
            <Text style={s.linkChev}>{'\u203A'}</Text>
          </Pressable>
        </View>
        <Text style={s.footer}>© 2026 The Filter List</Text>
      </View>
      {/* Particles overlay in a Modal — guaranteed full-screen,
          window-relative coordinate space. */}
      <Modal
        visible={particles.length > 0}
        transparent
        animationType="none"
        statusBarTranslucent
        hardwareAccelerated
      >
        <View pointerEvents="none" style={{ flex: 1 }}>
          {particles.map(p => (
            <Particle
              key={p.id}
              startX={p.startX}
              startY={p.startY}
              targetX={p.targetX}
              targetY={p.targetY}
              fizzleDelay={p.fizzleDelay}
              vacuumDelay={p.vacuumDelay}
              size={p.size}
              color={p.color}
              peakOpacity={p.peakOpacity}
              swirlFactor={p.swirlFactor}
            />
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6,
    },
    body: { flex: 1, paddingHorizontal: 18, paddingBottom: 24 },
    brandBlock: { alignItems: 'center', marginTop: 16, marginBottom: 10 },
    logoBox: {
      width: 80, height: 80,
      borderRadius: 16,
      borderWidth: 1.5, borderColor: t.iconBorder,
      backgroundColor: t.bg,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 14,
    },
    appName: {
      fontSize: 22, fontWeight: '800', letterSpacing: 0.3,
      color: t.brand || t.ink,
    },
    version: { fontSize: 13, color: t.muted, marginTop: 4 },
    tagline: {
      fontSize: 15, color: t.inkSoft, textAlign: 'center', lineHeight: 21,
      paddingHorizontal: 12, marginTop: 8,
    },
    spacer: { flex: 1, minHeight: 20 },
    label: {
      ...t.type.kicker, color: t.muted, textTransform: 'uppercase',
      marginTop: 8, marginBottom: 8, paddingLeft: 13,
    },
    linkRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      borderRadius: 12, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card,
      marginBottom: 8,
    },
    linkRowPressed: { backgroundColor: t.tabIdleBg },
    linkTxt: { fontSize: 15, fontWeight: '600', color: t.ink },
    linkChev: { fontSize: 22, color: t.muted },
    footer: {
      fontSize: 12, color: t.muted, textAlign: 'center', marginTop: 16,
    },
  });
}