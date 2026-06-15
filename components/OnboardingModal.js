// components/OnboardingModal.js
//
// First-run intro. A full-screen swipeable carousel shown ONCE, the first time
// the app launches, over the seeded home screen — so the "this is sample data"
// slide lands while the sample data is visible behind it.
//
// Gating is a single AsyncStorage flag (thefilterlist.onboarded.v1), separate
// from the seed marker in data/store.js: this is "have you seen the intro",
// not "is this sample data". It's set when the user finishes OR skips, so it
// never shows twice. A fresh install (empty storage) clears it and re-shows it,
// which is the same delete-app + run:ios flow used to re-test the seed.
//
// Self-contained: mount <OnboardingModal /> once near the root of the home
// screen and it handles its own visibility. No props, no store changes.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, ScrollView, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/theme';
import BrandMark from './BrandMark';

const ONBOARDED_KEY = 'thefilterlist.onboarded.v1';

// Welcome-tour icon glyph color — the emerald from the app icon.
const ICON_GLYPH = '#10B981'; // emerald — matches the icon fill

// Imperative replay trigger. The mounted modal registers its opener here, so any
// screen (e.g. Help & Tips) can call replayOnboarding() to re-show the intro —
// no props or navigation needed. A React Native <Modal> presents above the whole
// app, so it appears over whatever screen is currently showing.
let _opener = null;
export function replayOnboarding() { if (_opener) _opener(); }

const SLIDES = [
  {
    brand: true,
    title: 'Welcome to The Filter List',
    body: 'Keep track of every filter across your home, car, and workplace — and always know what\u2019s due next.',
  },
  {
    icon: 'rectangle.stack.fill',
    title: 'Assets, Devices, Filters',
    body: 'Group by Asset (Home, Auto, Work), add the Devices that take filters \u2014 a furnace, the fridge, your car \u2014 and track each Filter on its own schedule.',
  },
  {
    icon: 'bell.badge.fill',
    title: 'Stay ahead of every change',
    body: 'The home screen shows what\u2019s due soon at a glance. Keep an on-hand count so you never run out, and turn on reminders to get notified before a filter is due.',
  },
  {
    icon: 'sparkles',
    title: 'Sample data to explore',
    body: 'We\u2019ve added a few sample devices so you can see how everything works. When you\u2019re ready to start your own, remove them anytime under Settings \u203a Backup & Restore \u203a Delete Sample Data \u2014 anything you\u2019ve added or edited is never touched.',
  },
];

export default function OnboardingModal() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState(0);
  const scrollRef = useRef(null);

  // Decide visibility after an async flag read so there's no flash of the modal
  // for already-onboarded users.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDED_KEY);
        if (alive && !seen) setVisible(true);
      } catch (e) { /* if storage read fails, just don't show */ }
    })();
    return () => { alive = false; };
  }, []);

  // Register the imperative opener so replayOnboarding() can re-show the intro
  // from anywhere (e.g. a "Replay intro" row in Help & Tips).
  useEffect(() => {
    _opener = () => { setPage(0); setVisible(true); };
    return () => { _opener = null; };
  }, []);

  const finish = async () => {
    setVisible(false);
    try { await AsyncStorage.setItem(ONBOARDED_KEY, '1'); } catch (e) { /* non-fatal */ }
  };

  const goNext = () => {
    if (page >= SLIDES.length - 1) { finish(); return; }
    const next = page + 1;
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  const onMomentumEnd = (e) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  const s = makeStyles(t);
  const last = page === SLIDES.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={finish}
      onShow={() => scrollRef.current?.scrollTo({ x: 0, animated: false })}
    >
      <View style={[s.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.topBar}>
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={s.skip}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={s.flex}
        >
          {SLIDES.map((sl, i) => (
            <View key={i} style={[s.slide, { width }]}>
              {sl.brand ? (
                <View style={s.brandWrap}><BrandMark size={96} /></View>
              ) : (
                <View style={s.iconWrap}>
                  <SymbolView name={sl.icon} size={62} tintColor={ICON_GLYPH} resizeMode="scaleAspectFit" />
                </View>
              )}
              <Text style={s.slideTitle}>{sl.title}</Text>
              <Text style={s.slideBody}>{sl.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === page && s.dotActive]} />
          ))}
        </View>

        <View style={s.footer}>
          <Pressable style={s.cta} onPress={goNext}>
            <Text style={s.ctaTxt}>{last ? 'Get Started' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    flex: { flex: 1 },

    topBar: {
      flexDirection: 'row', justifyContent: 'flex-end',
      paddingHorizontal: 20, paddingTop: 12, minHeight: 28,
    },
    skip: { fontSize: 17, fontWeight: '600', color: t.muted },

    slide: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 36,
    },
    iconWrap: {
      width: 112, height: 112, borderRadius: 28,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card,
      marginBottom: 32,
    },
    brandWrap: {
      width: 112, height: 112,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 32,
    },
    slideTitle: {
      fontSize: 24, fontWeight: '800', color: t.ink,
      textAlign: 'center', marginBottom: 14, letterSpacing: -0.3,
    },
    slideBody: {
      fontSize: 16, color: t.inkSoft, textAlign: 'center', lineHeight: 24,
      maxWidth: 340,
    },

    dots: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
      gap: 8, paddingVertical: 20,
    },
    dot: {
      width: 8, height: 8, borderRadius: 4, backgroundColor: t.line,
    },
    dotActive: { backgroundColor: t.brand, width: 22 },

    footer: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
    cta: {
      paddingVertical: 15, borderRadius: 12, backgroundColor: t.tabIdleBg,
      alignItems: 'center', justifyContent: 'center', minHeight: 52,
    },
    ctaTxt: { fontSize: 16, fontWeight: '700', color: t.ink },
  });
}