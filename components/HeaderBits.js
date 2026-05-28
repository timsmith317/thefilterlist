// components/HeaderBits.js — reusable header pieces.
// BackButton: < chevron with text nudged tight against it.
// PillButton: grey-pill style matching the Settings pill (used for Add, Edit, Save).

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

// Grey pill action button matching the Settings pill style.
// Optional `icon` prop renders a leading icon component.
export function PillButton({ onPress, label, icon, primary = false }) {
  const t = useTheme();
  const s = makeStyles(t);
  return (
    <Pressable style={[s.pill, primary && s.pillPrimary]} onPress={onPress} hitSlop={8}>
      {icon ? <View style={{ marginRight: 5 }}>{icon}</View> : null}
      <Text style={[s.pillTxt, primary && s.pillTxtPrimary]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    back: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
    // gap removed; use marginLeft on the text for tighter, controlled spacing.
    backTxt: { color: t.ink, fontSize: 16, fontWeight: '600', marginLeft: -2 },
    pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: t.tabIdleBg },
    pillPrimary: { backgroundColor: t.btnBg },
    pillTxt: { fontSize: 12.5, fontWeight: '600', color: t.inkSoft },
    pillTxtPrimary: { color: t.btnInk, fontWeight: '700' },
  });
}
