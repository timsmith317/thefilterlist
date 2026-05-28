// components/HeaderBits.js — reusable header pieces.
// BackButton: tight (but not too tight) chevron-to-text spacing.
// PillButton: SINGLE grey pill style — used for Settings, +Add, Edit, Save.
// (The previous `primary` variant has been removed for a unified visual
// language; if callers still pass `primary`, it's safely ignored.)

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/theme';
import { IconBack } from '../theme/Icons';

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
export function PillButton({ onPress, label, icon, primary }) {
  const t = useTheme();
  const s = makeStyles(t);
  return (
    <Pressable style={s.pill} onPress={onPress} hitSlop={8}>
      {icon ? <View style={{ marginRight: 5 }}>{icon}</View> : null}
      <Text style={s.pillTxt}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    back: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    // Chevron-to-text margin: -2 gives a comfortable but tight gap.
    // (Was -6 in pass 3, which Tim found too tight.)
    backTxt: { color: t.ink, fontSize: 16, fontWeight: '600', marginLeft: -2 },
    pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: t.tabIdleBg },
    pillTxt: { fontSize: 12.5, fontWeight: '600', color: t.inkSoft },
  });
}
