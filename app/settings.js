// app/settings.js — Settings hub.
//
// Layout pattern matches the subscreens (Reminders, Filters, Assets):
//   - <BackButton> at top-left
//   - Big title below (canonical 26/800/0.5 via t.type.screenTitle)
//   - Subtitle (13pt, muted)
//   - Stack of bordered cards, each linking to a subscreen (including About)
//
// Cards link via `route`. If a row is ever added without a route, it
// renders without a chevron and shows a "coming soon" alert on tap.
// Appearance opens as a modal (declared in _layout.js) but rows here
// don't need to know that — router.push handles both.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';
import { BackButton } from '../components/HeaderBits';

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const s = makeStyles(t);

  // Row order is usage-based: Devices → Filters → Assets → Reminders → Backup →
  // Appearance → Help → About. Every row is a bordered chevron card.
  // (Categories were removed — assets are now the single organizing dimension.)
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
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>

      <ScrollView style={s.scrollView} contentContainerStyle={s.scroll}>
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
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6,
    },
    scroll: { paddingHorizontal: 18, paddingBottom: 24 },
    scrollView: { flex: 1 },

    title: { ...t.type.screenTitle, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16, marginBottom: 22, lineHeight: 18 },

    cards: {},
    card: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: 12, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card,
      marginBottom: 8,
    },
    cardPressed: { backgroundColor: t.tabIdleBg },
    cardLabel: { fontSize: 16, fontWeight: '700', color: t.ink },
    cardDesc:  { fontSize: 13, color: t.muted, marginTop: 3 },
    chev: { fontSize: 22, color: t.muted, paddingLeft: 8 },
  });
}
