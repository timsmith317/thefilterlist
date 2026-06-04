// app/settings.js — Settings hub.
//
// Layout pattern matches the subscreens (Reminders, Categories, Parts):
//   - <BackButton> at top-left
//   - Big title below (canonical 26/800/0.5 via t.type.screenTitle)
//   - Subtitle (13pt, muted)
//   - Stack of bordered cards, each linking to a subscreen
//
// Cards link via `route`. If a row is ever added without a route, it
// renders without a chevron and shows a "coming soon" alert on tap —
// defensive code path; all current rows have routes.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';
import { BackButton } from '../components/HeaderBits';

// Nudge the bottom "About" link vertically. Negative = up, positive = down.
const ABOUT_NUDGE_Y = -8;

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const s = makeStyles(t);

  // Row order is usage-based: Filters → Parts → Assets → Categories →
  // Reminders → Backup. About lives at the bottom as a centered text link
  // (not a chevron row). Built rows have a route; unbuilt rows have
  // route:null and render without a chevron.
  const rows = [
    { k: 'filters',    label: 'Filters',           desc: 'Add, edit, and schedule filters',   route: '/settings/filters' },
    { k: 'parts',      label: 'Parts Inventory',   desc: 'Track on-hand stock and reorders',  route: '/settings/parts' },
    { k: 'assets',     label: 'Assets & Archive',  desc: 'Manage homes, cars, archive',       route: '/settings/assets' },
    { k: 'categories', label: 'Categories',        desc: 'Rename or add categories',          route: '/settings/categories' },
    { k: 'reminders',  label: 'Reminders',         desc: 'Push notifications, lead time',     route: '/settings/reminders' },
    { k: 'backup',     label: 'Backup & Restore',  desc: 'Export / import your data',         route: '/settings/backup' },
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
        <Text style={s.sub}>Configure filters, reminders, categories, parts, and backups.</Text>

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

      {/* About lives here as a centered text link, pinned to the bottom so
          it's always reachable without scrolling. */}
      <View style={[s.aboutFooter, { paddingBottom: Math.max(insets.bottom, 12), transform: [{ translateY: ABOUT_NUDGE_Y }] }]}>
        <Pressable hitSlop={10} onPress={() => router.push('/settings/about')}>
          <Text style={s.aboutLink}>About</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },

    // Matches subscreens: BackButton sits in a slim head row at top-left.
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6,
    },

    scroll: { paddingHorizontal: 18, paddingBottom: 24 },
    scrollView: { flex: 1 },

    // About — centered text link pinned at the bottom of the screen.
    aboutFooter: { alignItems: 'center', paddingTop: 8, paddingHorizontal: 18 },
    aboutLink: { fontSize: 16, fontWeight: '700', color: t.ink },

    // Canonical screen title — 26/800/0.5 via t.type.screenTitle. Same
    // token as Due Soon, Filter detail, and every other screen header.
    title: {
      ...t.type.screenTitle, color: t.ink,
      marginTop: 4, paddingLeft: 16,
    },
    sub: {
      fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16,
      marginBottom: 22, lineHeight: 18,
    },

    cards: {},

    // Card metrics align with the row pattern used in reminders.js
    // (paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, etc.)
    // but with a touch more vertical room since each card has two lines.
    card: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 11,
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