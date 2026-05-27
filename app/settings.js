// app/settings.js — Settings hub.
import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';
import { IconBack } from '../theme/Icons';

export default function Settings() {
  const t = useTheme();
  const router = useRouter();
  const s = makeStyles(t);

  const rows = [
    { k: 'reminders', label: 'Reminders', desc: 'Push notifications, lead time', go: null },
    { k: 'categories', label: 'Categories', desc: 'Rename or add categories', go: null },
    { k: 'assets', label: 'Assets & Archive', desc: 'Manage homes, cars, archive', go: null },
    { k: 'parts', label: 'Parts Inventory', desc: 'Track on-hand stock and reorders', go: '/settings/parts' },
    { k: 'backup', label: 'Backup & Restore', desc: 'Export / import your data', go: null },
    { k: 'about', label: 'About', desc: 'The Filter List', go: null },
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10}>
          <IconBack size={26} color={t.ink} /><Text style={s.backTxt}>Back</Text>
        </Pressable>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 64 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {rows.map(r => (
          <Pressable key={r.k} style={[s.row, !r.go && s.rowDisabled]} onPress={() => r.go && router.push(r.go)}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{r.label}</Text>
              <Text style={s.rowDesc}>{r.desc}</Text>
            </View>
            <Text style={s.chev}>›</Text>
          </Pressable>
        ))}
        <Text style={s.note}>Sections without a chevron are coming next.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 6, width: 90 },
    backTxt: { color: t.ink, fontSize: 16, fontWeight: '600' },
    title: { fontSize: 18, fontWeight: '800', color: t.ink },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 16, marginBottom: 10 },
    rowDisabled: { opacity: 0.55 },
    rowLabel: { fontSize: 15, fontWeight: '600', color: t.ink },
    rowDesc: { fontSize: 12.5, color: t.muted, marginTop: 2 },
    chev: { fontSize: 22, color: t.muted },
    note: { fontSize: 12.5, color: t.muted, fontStyle: 'italic', textAlign: 'center', marginTop: 16 },
  });
}
