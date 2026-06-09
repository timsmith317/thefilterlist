// components/StagesEditor.js — the per-stage schedule editor shared by New and
// Edit Device.
//
// Progressive disclosure:
//   - ONE stage: a plain INTERVAL + FILTER pair (looks like the old single
//     schedule form) plus a "+ Add stage" affordance. Most devices stay here.
//   - TWO+ stages: each stage becomes a titled block ("Stage N") with its own
//     interval, its own filter, and a Remove control, separated by dividers.
//
// INTERVAL layout: the number field fills the row (flex), then a centered,
// borderless unit label showing ONE unit at a time, then an up/down chevron
// pair right-justified to the content edge.
//
// LOOPED unit roller: the list is the units with a hidden clone on each end
// ([Years, Days, Months, Years, Days]). Stepping always animates one slot in
// the tapped direction, so the spin direction is CONSTANT — a forward (down)
// tap goes Days->Months->Years->Days->... always scrolling down; the wrap lands
// on a clone, then silently snaps to the matching real slot (same label, so the
// jump is invisible). Up tap mirrors it backward. Swiping the label is
// free-form/directional. A `lock` ignores the programmatic spin's momentum so
// it can't revert.
//
// Presentational only: the parent owns the draft stages and passes handlers.
// Filter selection is delegated up via onPickFilter(stageId).

import React, { useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { INTERVAL_UNITS } from '../lib/interval';

const digits = (v) => v.replace(/[^0-9]/g, '');

const FIELD_H = 48;     // number field height; also the roller's one-row height
const UNIT_W = 80;      // unit label column — wide enough to center "Months"

// Looped roller geometry.
const N = INTERVAL_UNITS.length;
const REAL0 = 1;                 // first real slot (slot 0 is a clone)
const SLOTS = N + 2;             // one clone on each end
const ROLL_DATA = [INTERVAL_UNITS[N - 1], ...INTERVAL_UNITS, INTERVAL_UNITS[0]];
const unitIdxOfSlot = (slot) => (((slot - REAL0) % N) + N) % N;

// Unit roller (module-level so it doesn't remount each render).
function UnitRoller({ unitKey, onPick, t }) {
  const ref = useRef(null);
  const lock = useRef(false);     // true while a programmatic spin is settling
  const timer = useRef(null);
  const propIdx = Math.max(0, INTERVAL_UNITS.findIndex(u => u.key === unitKey));
  const slotRef = useRef(REAL0 + propIdx);

  const scrollTo = (s, animated) => { if (ref.current) ref.current.scrollTo({ y: s * FIELD_H, animated }); };
  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  // After landing on `target`, if it's a clone, silently jump to the matching
  // real slot (same unit shown -> invisible). Holds the lock for the duration.
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

  // Report the unit at `target` upward, optionally animating to it, then settle.
  const commit = (target, animated) => {
    if (animated) scrollTo(target, true);
    onPick(INTERVAL_UNITS[unitIdxOfSlot(target)].key);
    settle(target);
  };

  // Chevron / tap: always move one slot in the given direction (constant-
  // direction spin); the clones make the wrap seamless.
  const step = (dir) => commit(slotRef.current + dir, true);

  useEffect(() => () => clearTimer(), []);

  // Initial position + external (non-self) unit changes. Self-driven changes
  // hold the lock, so this won't fight them.
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
            if (lock.current) return;                      // ignore programmatic spin
            const landed = Math.max(0, Math.min(SLOTS - 1, Math.round(e.nativeEvent.contentOffset.y / FIELD_H)));
            commit(landed, false);                         // already scrolled here; commit + settle
          }}
        >
          {ROLL_DATA.map((u, i) => (
            <Pressable key={i} style={s_roller.item} onPress={() => step(1)}>
              <Text style={[s_roller.unit, { color: t.ink }]}>{u.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Both chevrons are one big forward-only target — any tap spins down. */}
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

export default function StagesEditor({
  stages,
  filters,
  onSetValue,
  onSetUnit,
  onAddStage,
  onRemoveStage,
  onPickFilter,
}) {
  const t = useTheme();
  const s = makeStyles(t);
  const multi = stages.length > 1;

  const filterName = (id) => {
    if (!id) return null;
    const p = filters.find(x => x.id === id);
    return p ? (p.name || 'Untitled filter') : null;
  };

  // Number field fills the row; unit roller + right-justified chevrons follow.
  // The TextInput is inlined (not an inner component) so it keeps focus across
  // the re-renders each keystroke triggers.
  const intervalRow = (st) => (
    <View style={s.intervalRow}>
      <TextInput
        style={s.numInput}
        value={st.value}
        onChangeText={(v) => onSetValue(st.id, digits(v))}
        keyboardType="number-pad"
        placeholderTextColor={t.muted}
        maxLength={4}
      />
      <UnitRoller unitKey={st.unit} onPick={(u) => onSetUnit(st.id, u)} t={t} />
    </View>
  );

  const filterRow = (st) => {
    const name = filterName(st.filterId);
    return (
      <Pressable style={s.pickerRow} onPress={() => onPickFilter(st.id)}>
        <Text style={[s.pickerValue, !name && s.pickerPlaceholder]} numberOfLines={1}>
          {name || 'None'}
        </Text>
        <Text style={s.chev}>›</Text>
      </Pressable>
    );
  };

  if (!multi) {
    const st = stages[0];
    return (
      <View>
        <Text style={s.label}>INTERVAL</Text>
        {intervalRow(st)}

        <Text style={s.label}>FILTER</Text>
        {filterRow(st)}
        <Text style={s.hint}>Link a filter to track stock and reorder info.</Text>

        <Pressable style={s.addStage} onPress={onAddStage}>
          <Text style={s.addStageTxt}>+ Add stage</Text>
        </Pressable>
        <Text style={s.hint}>
          Add a stage for multi-cartridge units like RO systems — each stage is
          scheduled on its own.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={s.label}>STAGES</Text>
      {stages.map((st, i) => (
        <View key={st.id} style={[s.stageBlock, i > 0 && s.stageDivider]}>
          <View style={s.stageHead}>
            <Text style={s.stageTitle}>Stage {i + 1}</Text>
            <Pressable onPress={() => onRemoveStage(st.id)} hitSlop={8}>
              <Text style={s.remove}>Remove</Text>
            </Pressable>
          </View>

          <Text style={s.miniLabel}>INTERVAL</Text>
          {intervalRow(st)}

          <Text style={s.miniLabel}>FILTER</Text>
          {filterRow(st)}
        </View>
      ))}

      <Pressable style={s.addStage} onPress={onAddStage}>
        <Text style={s.addStageTxt}>+ Add stage</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 13 },
    miniLabel: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', fontSize: 11, marginTop: 14, marginBottom: 6, paddingLeft: 13 },

    // Number field fills the row; unit roller + chevrons sit at the right edge.
    intervalRow: { flexDirection: 'row', alignItems: 'center' },
    numInput: { flex: 1, height: FIELD_H, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16, marginRight: 14 },

    pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    pickerValue: { fontSize: 16, color: t.ink, flex: 1, marginRight: 8 },
    pickerPlaceholder: { color: t.muted },
    chev: { fontSize: 22, color: t.muted },
    hint: { fontSize: 12, color: t.muted, marginTop: 10, paddingLeft: 13 },

    // Multi-stage: each stage a block, dividers between.
    stageBlock: { marginTop: 4 },
    stageDivider: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: t.line },
    stageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 13, marginBottom: 2 },
    stageTitle: { fontSize: 15, fontWeight: '800', color: t.ink },
    remove: { fontSize: 13, color: '#dc2626', fontWeight: '600' },

    addStage: { marginTop: 16, padding: 13, borderRadius: t.radius.btn, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, alignItems: 'center' },
    addStageTxt: { fontSize: 14, fontWeight: '700', color: t.ink },
  });
}
