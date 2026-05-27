// app/settings.js — Settings hub (stub for now; the nuts-and-bolts screen).
import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const s = makeStyles(t);
  const rows = [
    { k: 'reminders', label: 'Reminders', desc: 'Push notifications, lead time' },
    { k: 'categories', label: 'Categories', desc: 'Rename or add categories' },
    { k: 'assets', label: 'Assets & Archive', desc: 'Manage homes, cars, archive' },
    { k: 'backup', label: 'Backup & Restore', desc: 'Export / import your data' },
    { k: 'about', label: 'About', desc: 'The Filter List' },
  ];
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Text style={s.back}>‹ Done</Text></Pressable>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        {rows.map(r => (
          <View key={r.k} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{r.label}</Text>
              <Text style={s.rowDesc}>{r.desc}</Text>
            </View>
            <Text style={s.chev}>›</Text>
          </View>
        ))}
        <Text style={s.note}>These sections are coming next as we build them out.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
    back: { color: t.inkSoft, fontSize: 15, width: 50 },
    title: { fontSize: 18, fontWeight: '800', color: t.ink },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 16, marginBottom: 10 },
    rowLabel: { fontSize: 15, fontWeight: '600', color: t.ink },
    rowDesc: { fontSize: 12.5, color: t.muted, marginTop: 2 },
    chev: { fontSize: 22, color: t.muted },
    note: { fontSize: 12.5, color: t.muted, fontStyle: 'italic', textAlign: 'center', marginTop: 16 },
  });
}
