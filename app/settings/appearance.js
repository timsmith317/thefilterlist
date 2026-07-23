// app/settings/appearance.js — Appearance (theme mode) modal.
//
// Presented as a modal (Cancel / Save header, matching New Asset / New
// Filter) rather than a pushed settings subscreen — it's a quick pick,
// not a destination.
//
// Behavior:
//   - Three stacked option buttons: System / Light / Dark. Backup-screen
//     button footprint (centered, minWidth 200, minHeight 44). Idle = the
//     Restore button look (bg fill + line border); selected = the Backup
//     button's grey tabIdleBg fill. No dark fills — consistent with the
//     rest of the app's buttons.
//   - LIVE PREVIEW: tapping an option applies the scheme immediately via
//     Appearance.setColorScheme(), so the user sees the theme before
//     committing. Nothing is persisted until Save.
//   - Save persists via useThemeMode().setMode and closes.
//   - Back — or ANY unsaved exit, including swiping the sheet down —
//     reverts to the persisted mode. The revert lives in an unmount
//     cleanup, so every dismissal path is covered.
//   - Header uses the standard <Back chevron (not Cancel) with paddingTop
//     tuned so it aligns with the chevron on the pushed settings screens
//     despite the sheet's zero top inset — see head style for the math.
//
// Route note: declare this in app/_layout.js the same way asset/new is
// declared, e.g.:
//   <Stack.Screen name="settings/appearance" options={{ presentation: 'modal' }} />

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Appearance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme, useThemeMode } from '../../theme/theme';
import { BackButton, PillButton } from '../../components/HeaderBits';

const OPTIONS = [
  { k: 'system', label: 'System' },
  { k: 'light',  label: 'Light' },
  { k: 'dark',   label: 'Dark' },
];

export default function AppearanceSettings() {
  const t = useTheme();
  const router = useRouter();
  const [mode, setMode] = useThemeMode();          // persisted mode
  const [selected, setSelected] = useState(mode);  // what's highlighted now
  const savedRef = useRef(false);                  // did the user hit Save?
  const initialModeRef = useRef(mode);             // mode to revert to on cancel

  const s = makeStyles(t);

  // Revert any un-saved preview on unmount. Covers Cancel, the hardware
  // back gesture, AND swiping the modal sheet down.
  useEffect(() => {
    return () => {
      if (!savedRef.current) {
        const m = initialModeRef.current;
        Appearance.setColorScheme(m === 'system' ? 'unspecified' : m);
      }
    };
  }, []);

  const choose = (k) => {
    setSelected(k);
    // Preview only — persisted on Save. useTheme() re-renders this screen
    // (and everything behind the sheet) in the new scheme instantly.
    Appearance.setColorScheme(k === 'system' ? 'unspecified' : k);
  };

  const onSave = () => {
    savedRef.current = true;
    setMode(selected); // applies + persists to AsyncStorage
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <View style={{ paddingLeft: t.isTablet ? 16 : 0 }}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={{ paddingRight: t.isTablet ? 16 : 0 }}>
          <PillButton label="Save" onPress={onSave} />
        </View>
      </View>

      <View style={s.body}>
        <Text style={s.title}>Appearance</Text>
        <Text style={s.sub}>Choose how The Filter List looks.</Text>

        <Text style={s.label}>THEME</Text>
        <View style={s.options}>
          {OPTIONS.map((o) => {
            const active = selected === o.k;
            return (
              <Pressable
                key={o.k}
                onPress={() => choose(o.k)}
                style={[s.optBtn, active && s.optBtnActive]}
              >
                <Text style={s.optTxt}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.hint}>
          System follows your iPhone's Light / Dark setting. Tap an option
          to preview it — nothing changes until you save.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    // paddingTop math: pushed settings screens sit at safe-area inset
    // (~59pt on 15 Pro Max) + 8. Inside a pageSheet the top inset is 0 and
    // the sheet's own edge is ~inset+10 (~69pt), so to land the chevron at
    // the same absolute height: (59 + 8) - 69 ≈ 0. Nudge 0–6 to taste if
    // it reads flush against the sheet's rounded edge on device.
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 0, paddingBottom: 6,
    },

    body: {
      paddingBottom: 40,
      // iPad: wider inset (matches other settings screens), left-aligned. No
      // centering cap — the buttons are full-width blocks, which balances the
      // left-aligned layout (same fix as Backup & Restore).
      paddingHorizontal: t.isTablet ? t.ui(32) : 18,
    },

    title: { ...t.type.screenTitle, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: t.uit(13), color: t.muted, marginTop: 4, paddingLeft: 16 },

    label: {
      ...t.type.kicker, color: t.muted, textTransform: 'uppercase',
      marginTop: 22, marginBottom: 8, paddingLeft: 13,
    },

    // iPhone: stacked full-width buttons. iPad: side-by-side row (System |
    // Light | Dark) so no single button stretches too wide on the big screen.
    options: t.isTablet
      ? { flexDirection: 'row', gap: t.ui(12), marginTop: 8 }
      : { gap: 12, marginTop: 8 },
    optBtn: {
      // iPhone stretch = full-width block; iPad each button flexes to share the
      // row equally.
      alignSelf: t.isTablet ? 'auto' : 'stretch',
      flex: t.isTablet ? 1 : undefined,
      paddingVertical: 12, paddingHorizontal: 28,
      minHeight: 44,
      borderRadius: 10, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.bg,
      alignItems: 'center', justifyContent: 'center',
    },
    optBtnActive: { backgroundColor: t.tabIdleBg },
    optTxt:       { fontSize: t.uit(15), fontWeight: '700', color: t.ink },

    hint: {
      fontSize: t.uit(12), color: t.muted, textAlign: 'center',
      marginTop: 20, paddingHorizontal: 24, lineHeight: 17,
    },
  });
}