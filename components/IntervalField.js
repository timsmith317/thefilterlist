// components/IntervalField.js — a standalone interval input: a number field
// that fills the row + a looped Days/Months/Years unit roller right-justified
// to the content edge. This is the same control used inside the Filter editor's
// StagesEditor, lifted out so the Part screens can edit a part's recommended
// interval with the exact same feel.
//
// Controlled: the parent owns { value (string of digits), unit (key) } and gets
// onChangeValue(v) / onChangeUnit(key). Convert to/from a day count with
// intervalToDays / daysToInterval from lib/interval.
//
// Looped roller: the list is the units with a hidden clone on each end
// ([Years, Days, Months, Years, Days]). Stepping always animates one slot in
// the tapped direction (constant-direction spin); the wrap lands on a clone,
// then silently snaps to the matching real slot (same label -> invisible).

import React, { useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { INTERVAL_UNITS } from '../lib/interval';

const digits = (v) => v.replace(/[^0-9]/g, '');

const FIELD_H = 48;
const UNIT_W = 80;

const N = INTERVAL_UNITS.length;
const REAL0 = 1;
const SLOTS = N + 2;
const ROLL_DATA = [INTERVAL_UNITS[N - 1], ...INTERVAL_UNITS, INTERVAL_UNITS[0]];
const unitIdxOfSlot = (slot) => (((slot - REAL0) % N) + N) % N;

function UnitRoller({ unitKey, onPick, t }) {
  const ref = useRef(null);
  const lock = useRef(false);
  const timer = useRef(null);
  const propIdx = Math.max(0, INTERVAL_UNITS.findIndex(u => u.key === unitKey));
  const slotRef = useRef(REAL0 + propIdx);

  const scrollTo = (s, animated) => { if (ref.current) ref.current.scrollTo({ y: s * FIELD_H, animated }); };
  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const settle = (target) => {
    clearTimer();
    lock.current = true;
    timer.current = setTimeout(() => {
      const real = REAL0 + unitIdxOfSlot(target);
      if (target !== real) scrollTo(real, false);
      slotRef.current = real;
      lock.current = false;
      timer.current = null;
    }, 340);
  };

  const commit = (target, animated) => {
    if (animated) scrollTo(target, true);
    onPick(INTERVAL_UNITS[unitIdxOfSlot(target)].key);
    settle(target);
  };

  const step = (dir) => commit(slotRef.current + dir, true);

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (lock.current) return;
    if (unitIdxOfSlot(slotRef.current) !== propIdx) {
      const ns = REAL0 + propIdx;
      slotRef.current = ns;
      scrollTo(ns, false);
    }
  }, [propIdx]);

  return (
    <View style={s_roller.row}>
      <View style={{ width: UNIT_W, height: FIELD_H, overflow: 'hidden' }}>
        <ScrollView
          ref={ref}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={FIELD_H}
          decelerationRate="fast"
          onLayout={() => scrollTo(slotRef.current, false)}
          onMomentumScrollEnd={(e) => {
            if (lock.current) return;
            const landed = Math.max(0, Math.min(SLOTS - 1, Math.round(e.nativeEvent.contentOffset.y / FIELD_H)));
            commit(landed, false);
          }}
        >
          {ROLL_DATA.map((u, i) => (
            <Pressable key={i} style={s_roller.item} onPress={() => step(1)}>
              <Text style={[s_roller.unit, { color: t.ink }]}>{u.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Pressable onPress={() => step(1)} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }} style={s_roller.chevs}>
        <Text style={[s_roller.chev, { color: t.muted, transform: [{ scaleY: -1 }] }]}>⌄</Text>
        <Text style={[s_roller.chev, { color: t.muted }]}>⌄</Text>
      </Pressable>
    </View>
  );
}

const s_roller = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { height: FIELD_H, alignItems: 'center', justifyContent: 'center' },
  unit: { fontSize: 16, fontWeight: '500' },
  chevs: { marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 20, lineHeight: 13, fontWeight: '600' },
});

export default function IntervalField({ value, unit, onChangeValue, onChangeUnit }) {
  const t = useTheme();
  const s = makeStyles(t);
  return (
    <View style={s.row}>
      <TextInput
        style={s.numInput}
        value={value}
        onChangeText={(v) => onChangeValue(digits(v))}
        keyboardType="number-pad"
        placeholderTextColor={t.muted}
        maxLength={4}
      />
      <UnitRoller unitKey={unit} onPick={onChangeUnit} t={t} />
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    numInput: {
      flex: 1, height: FIELD_H, paddingHorizontal: 13, borderRadius: 10,
      borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card,
      color: t.ink, fontSize: 16, marginRight: 14,
    },
  });
}