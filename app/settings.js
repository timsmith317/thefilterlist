// app/settings.js — Settings hub. Bordered chevron cards, usage-ordered.
//
// NOTE (iPad landscape scroll): when returning to this screen from a subscreen
// on iPad in landscape, iOS natively resets the scroll offset to top. This is a
// platform behavior in the native stack that isn't reachable from RN's JS/props
// API (verified: not a remount, not a frame shift, not a JS scrollTo). iPhone
// and iPad portrait are unaffected. Documented as a known minor issue.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';
import { BackButton } from '../components/HeaderBits';
import useFixScrollToTop from '../lib/useFixScrollToTop';

export default function Settings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = makeStyles(t);
  const scrollsToTop = useFixScrollToTop();

  // Row order is usage-based: Devices → Filters → Assets → Reminders → Backup →
  // Appearance → Help → About. Every row is a bordered chevron card.
  const rows = [
    { k: 'devices',    label: 'Devices',          desc: 'Add, edit, and schedule devices',  route: '/settings/devices' },
    { k: 'filters',    label: 'Filters',          desc: 'Track on-hand stock and reorders', route: '/settings/filters' },
    { k: 'assets',     label: 'Assets & Archive', desc: 'Manage and reorder your assets',   route: '/settings/assets' },
    { k: 'reminders',  label: 'Reminders',        desc: 'Push notifications, lead time',    route: '/settings/reminders' },
    { k: 'backup',     label: 'Backup & Restore', desc: 'Export / import your data',        route: '/settings/backup' },
    { k: 'appearance', label: 'Appearance',       desc: 'System, light, or dark theme',     route: '/settings/appearance' },
    { k: 'help',       label: 'Help & Tips',      desc: 'How the app works',                route: '/settings/help' },
    { k: 'about',      label: 'About',            desc: 'Version, credits, and licenses',   route: '/settings/about' },
  ];

  const onPress = (row) => {
    if (row.route) router.push(row.route);
    else Alert.alert(row.label, 'This section is coming soon.');
  };

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scroll}
        scrollsToTop={scrollsToTop}
      >
        <Text style={s.title}>Settings</Text>
        <Text style={s.sub}>Configure devices, reminders, filters, and backups.</Text>

        <View style={s.cards}>
          {rows.map((r) => (
            <Pressable
              key={r.k}
              style={({ pressed }) => [s.card, pressed && s.cardPressed]}
              onPress={() => onPress(r)}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardLabel}>{r.label}</Text>
                <Text style={s.cardDesc}>{r.desc}</Text>
              </View>
              {r.route && <Text style={s.chev}>{'\u203A'}</Text>}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: t.isTablet ? t.ui(32) : 18, paddingTop: 8, paddingBottom: 6,
    },
    scroll: {
      paddingHorizontal: t.isTablet ? t.ui(32) : 18,
      paddingBottom: 24,
    },
    scrollView: { flex: 1 },

    title: { ...t.type.screenTitle, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: t.uit(13), color: t.muted, marginTop: 4, paddingLeft: 16, marginBottom: 22, lineHeight: t.uit(18) },

    cards: {},
    card: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: t.ui(16), paddingVertical: t.ui(10),
      backgroundColor: t.card, borderWidth: 1, borderColor: t.line,
      borderRadius: 12, marginBottom: 10,
    },
    cardPressed: { backgroundColor: t.tabIdleBg },
    cardLabel: { fontSize: t.uit(16), fontWeight: '700', color: t.ink },
    cardDesc:  { fontSize: t.uit(13), color: t.muted, marginTop: 3 },
    chev: { fontSize: t.uit(22), color: t.muted, paddingLeft: t.ui(8) },
  });
}