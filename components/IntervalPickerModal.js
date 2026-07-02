// components/IntervalPickerModal.js — bottom-sheet spinner for a stage interval.
//
// Two roll-able wheels: an AMOUNT column (1..max, where max depends on the
// unit) and a UNIT column (Days / Months / Years). Returns { value, unit } via
// onConfirm. Slide-up + dim animation mirrors DatePickerModal; the sheet is
// unmounted after the close animation so it never eats touches while hidden.
//
// The wheel is a pure-JS snap ScrollView (no native picker dependency): items
// are ITEM_H tall, the list is padded so any item can center under a fixed
// highlight band, and the selected index is the rounded scroll offset. Tap an
// item to jump to it. Themed via useTheme so it tracks light/dark.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Animated, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';
import { INTERVAL_UNITS } from '../lib/interval';

const SLIDE_DISTANCE = 600;
const ITEM_H = 40;
const VISIBLE = 5;                       // rows shown in each wheel (odd)
const PAD = ((VISIBLE - 1) / 2) * ITEM_H; // top/bottom padding so ends can center

// Sensible amount ceilings per unit.
const MAX_BY_UNIT = { days: 365, months: 24, years: 10 };

function Wheel({ data, index, onCommit, width, t }) {
  const ref = useRef(null);
  const [live, setLive] = useState(index);
  const idxFrom = (y) => Math.max(0, Math.min(data.length - 1, Math.round(y / ITEM_H)));
  const scrollTo = (i, animated) => { if (ref.current) ref.current.scrollTo({ y: i * ITEM_H, animated }); };

  // Re-sync when the selected index or the data length changes (e.g. the
  // amount range shrank because the unit changed).
  useEffect(() => { setLive(index); scrollTo(index, false); }, [index, data.length]);

  return (
    <View style={{ width, height: VISIBLE * ITEM_H }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onLayout={() => scrollTo(index, false)}
        onScroll={(e) => setLive(idxFrom(e.nativeEvent.contentOffset.y))}
        onMomentumScrollEnd={(e) => {
          const i = idxFrom(e.nativeEvent.contentOffset.y);
          setLive(i);
          scrollTo(i, true);
          onCommit(i);
        }}
        contentContainerStyle={{ paddingVertical: PAD }}
      >
        {data.map((label, i) => (
          <Pressable
            key={i}
            style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => { setLive(i); scrollTo(i, true); onCommit(i); }}
          >
            <Text style={{ fontSize: t.uit(20), color: i === live ? t.ink : t.muted, fontWeight: i === live ? '700' : '500' }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {/* Fixed center highlight band. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 6, right: 6, top: PAD, height: ITEM_H, borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.line }} />
    </View>
  );
}

export default function IntervalPickerModal({ visible, value, unit, title = 'Interval', onCancel, onConfirm }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = makeStyles(t, insets.bottom);

  const [internalVisible, setInternalVisible] = useState(visible);
  const slide = useRef(new Animated.Value(SLIDE_DISTANCE)).current;
  const dim = useRef(new Animated.Value(0)).current;

  const [un, setUn] = useState(unit || 'days');
  const [val, setVal] = useState(Math.max(1, value || 1));

  useEffect(() => {
    if (visible) {
      setUn(unit || 'days');
      setVal(Math.max(1, value || 1));
      setInternalVisible(true);
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(dim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else if (internalVisible) {
      Animated.parallel([
        Animated.timing(slide, { toValue: SLIDE_DISTANCE, duration: 220, useNativeDriver: true }),
        Animated.timing(dim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setInternalVisible(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const units = INTERVAL_UNITS;
  const unitIndex = Math.max(0, units.findIndex(u => u.key === un));
  const max = MAX_BY_UNIT[un] || 365;
  const amounts = useMemo(() => Array.from({ length: max }, (_, i) => String(i + 1)), [max]);
  const amountIndex = Math.max(0, Math.min(max - 1, val - 1));

  const onAmount = (i) => setVal(i + 1);
  const onUnit = (i) => {
    const k = units[i].key;
    setUn(k);
    const m = MAX_BY_UNIT[k] || 365;
    setVal(v => Math.min(v, m));
  };

  if (!internalVisible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onCancel}>
      <View style={s.fill}>
        <Animated.View style={[s.backdrop, { opacity: dim }]}>
          <Pressable style={{ flex: 1 }} onPress={onCancel} />
        </Animated.View>

        <Animated.View style={[s.sheet, { transform: [{ translateY: slide }] }]}>
          <View style={s.header}>
            <Pressable onPress={onCancel} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
            <Text style={s.title}>{title}</Text>
            <Pressable onPress={() => onConfirm(val, un)} hitSlop={10}><Text style={s.done}>Done</Text></Pressable>
          </View>

          <View style={s.wheels}>
            <Wheel data={amounts} index={amountIndex} onCommit={onAmount} width={110} t={t} />
            <Wheel data={units.map(u => u.label)} index={unitIndex} onCommit={onUnit} width={140} t={t} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(t, bottomInset) {
  return StyleSheet.create({
    fill: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: t.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingBottom: (bottomInset || 0) + 16,
      borderTopWidth: 1,
      borderColor: t.line,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.line, marginBottom: 6,
    },
    cancel: { color: t.inkSoft, fontSize: t.uit(15) },
    title: { fontSize: t.uit(16), fontWeight: '700', color: t.ink },
    done: { color: t.ink, fontSize: t.uit(15), fontWeight: '800' },
    wheels: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  });
}