// components/HeaderBits.js — reusable header pieces.
//
// BackButton: tight (but not too tight) chevron-to-text spacing.
// PillButton: SINGLE grey pill style — used for +Add, Edit, Save, Cancel,
//   Settings, etc.
//   Sized to match the Settings pill on the Due Soon screen for visual
//   consistency: fontSize 14, paddingHorizontal 14, paddingVertical 7,
//   gap 7 between optional icon and label.
//   (The previous `primary` variant has been removed for a unified visual
//   language; if callers still pass `primary`, it's safely ignored.)
//
// Label styling is controlled globally by two switches below:
//   - PILL_BOLD: false → normal weight (600); true → bold (700).
//   - PILL_INK:  false → t.inkSoft (slightly soft); true → t.ink (full black,
//     matching the Back label).
//   Both are TRUE: every pill label across the app renders bold + full black.
//   Individual callers can still override per-instance with the `bold` / `dark`
//   props if ever needed.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { IconBack } from '../theme/Icons';

// GLOBAL pill-label switches — locked to bold + full black.
const PILL_BOLD = true;
const PILL_INK = true;

export function BackButton({ onPress, label = 'Back' }) {
  const t = useTheme();
  const s = makeStyles(t);
  return (
    <Pressable style={s.back} onPress={onPress} hitSlop={10}>
      <IconBack size={26} color={t.ink} />
      <Text style={s.backTxt}>{label}</Text>
    </Pressable>
  );
}

// PillButton — single grey style. The `primary` prop is accepted but ignored
// to keep existing callers working without crashing during the transition.
// `bold` / `dark` override the global PILL_BOLD / PILL_INK defaults for this
// instance.
export function PillButton({ onPress, label, icon, primary, bold = PILL_BOLD, dark = PILL_INK }) {
  const t = useTheme();
  const s = makeStyles(t);
  return (
    <Pressable style={s.pill} onPress={onPress} hitSlop={8}>
      {icon ? <View>{icon}</View> : null}
      <Text style={[s.pillTxt, bold && s.pillTxtBold, dark && s.pillTxtInk]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    back: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    // Chevron-to-text margin: -2 gives a comfortable but tight gap.
    backTxt: { color: t.ink, fontSize: 16, fontWeight: '600', marginLeft: -2 },
    // Matches the Settings pill metrics on Due Soon for a unified look
    // across the app's header pills (Edit, Cancel, +Add, Save, Settings).
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: t.tabIdleBg,
    },
    pillTxt: { fontSize: 14, fontWeight: '600', color: t.inkSoft },
    // Applied when bold / dark (global switch or per-instance prop).
    pillTxtBold: { fontWeight: '700' },
    pillTxtInk: { color: t.ink },
  });
}