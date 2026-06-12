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
        Appearance.setColorScheme(m === 'system' ? null : m);
      }
    };
  }, []);

  const choose = (k) => {
    setSelected(k);
    // Preview only — persisted on Save. useTheme() re-renders this screen
    // (and everything behind the sheet) in the new scheme instantly.
    Appearance.setColorScheme(k === 'system' ? null : k);
  };

  const onSave = () => {
    savedRef.current = true;
    setMode(selected); // applies + persists to AsyncStorage
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <PillButton label="Save" onPress={onSave} />
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

    body: { paddingHorizontal: 18, paddingBottom: 40 },

    title: { ...t.type.screenTitle, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16 },

    label: {
      ...t.type.kicker, color: t.muted, textTransform: 'uppercase',
      marginTop: 22, marginBottom: 8, paddingLeft: 13,
    },

    // Backup-screen button footprint: centered, chunky, identical size
    // regardless of label length. Idle = Restore's white-fill-with-border
    // look; selected = Backup's grey fill (same as cardPressed). No dark
    // fill — that's tab/active-pill language, not button language.
    options: { gap: 12, marginTop: 8 },
    optBtn: {
      alignSelf: 'center',
      paddingVertical: 12, paddingHorizontal: 28,
      minWidth: 200, minHeight: 44,
      borderRadius: 10, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.bg,
      alignItems: 'center', justifyContent: 'center',
    },
    optBtnActive: { backgroundColor: t.tabIdleBg },
    optTxt:       { fontSize: 15, fontWeight: '700', color: t.ink },

    hint: {
      fontSize: 12, color: t.muted, textAlign: 'center',
      marginTop: 20, paddingHorizontal: 24, lineHeight: 17,
    },
  });
}
