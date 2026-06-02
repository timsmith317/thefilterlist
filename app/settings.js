// app/settings.js — Settings hub. Each row Pressable; rows with a route push
// to the corresponding screen. Rows without a built screen yet show a brief
// "coming soon" alert so taps aren't silent dead ends.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const s = makeStyles(t);

  // route: where this row links. If null, row is a not-yet-built stub.
  const rows = [
    { k: 'reminders',  label: 'Reminders',         desc: 'Notifications and lead time', route: '/settings/reminders' },
    { k: 'parts',      label: 'Parts Inventory',   desc: 'Manage shared parts',         route: '/settings/parts' },
    { k: 'categories', label: 'Categories',        desc: 'Rename or add categories',    route: null },
    { k: 'assets',     label: 'Assets & Archive',  desc: 'Manage homes, cars, archive', route: null },
    { k: 'backup',     label: 'Backup & Restore',  desc: 'Export / import your data',   route: null },
    { k: 'about',      label: 'About',             desc: 'The Filter List',             route: null },
  ];

  const onPress = (row) => {
    if (row.route) router.push(row.route);
    else Alert.alert(row.label, 'This section is coming soon.');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={s.back}>{'\u2039 Done'}</Text>
        </Pressable>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        {rows.map((r, i) => (
          <Pressable
            key={r.k}
            style={({ pressed }) => [
              s.row,
              i !== rows.length - 1 && s.rowDivider,
              pressed && s.rowPressed,
            ]}
            onPress={() => onPress(r)}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{r.label}</Text>
              <Text style={s.rowDesc}>{r.desc}</Text>
            </View>
            <Text style={s.chev}>{'\u203A'}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 22, paddingBottom: 10,
    },
    back: { color: t.inkSoft, fontSize: 15 },
    title: { fontSize: 17, fontWeight: '700', color: t.ink },

    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 4,
    },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: t.line },
    rowPressed: { backgroundColor: t.tabIdleBg, borderRadius: 8 },
    rowLabel: { fontSize: 16, color: t.ink, fontWeight: '600' },
    rowDesc:  { fontSize: 13, color: t.muted, marginTop: 2 },
    chev: { fontSize: 22, color: t.muted, paddingHorizontal: 6 },
  });
}