// app/settings.js — Settings hub.
//
// Header alignment:
//   - Header row (BackButton + right action) uses paddingHorizontal: 18.
//     The chevron sits at x=18, aligning with the left edge of the card
//     bounding boxes in the list below.
//   - Body content (title + list) uses paddingHorizontal: 18 too, so the
//     cards themselves start at x=18.
//   - The TITLE has an additional paddingLeft: 16 so it lines up with the
//     card *interior* text (which sits inside each card's padding: 16).
//   - The BACK TEXT visually lines up because the chevron's intrinsic
//     width + the small text gap gets us close to x=34 by construction.
//
// Net result: "Back" text and "Settings" title both align with the card
// label text below them.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';
import { BackButton } from '../components/HeaderBits';

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
        <BackButton onPress={() => router.back()} />
        <View />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        <Text style={s.title}>Settings</Text>
        <Text style={s.sub}>Configure reminders, categories, parts, and backups.</Text>

        <View style={{ marginTop: 16 }}>
          {rows.map(r => (
            <Pressable key={r.k} style={[s.row, !r.go && s.rowDisabled]} onPress={() => r.go && router.push(r.go)}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{r.label}</Text>
                <Text style={s.rowDesc}>{r.desc}</Text>
              </View>
              <Text style={s.chev}>›</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.note}>Sections without a chevron are coming next.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    // Head row at x=18 so chevron sits at the card's left edge.
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },
    // Title indented by the card's interior padding (16) so it lines up
    // with the card label text below.
    title: { ...t.type.title, fontSize: 26, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 16, marginBottom: 10 },
    rowDisabled: { opacity: 0.55 },
    rowLabel: { fontSize: 15, fontWeight: '600', color: t.ink },
    rowDesc: { fontSize: 12.5, color: t.muted, marginTop: 2 },
    chev: { fontSize: 22, color: t.muted },
    note: { fontSize: 12.5, color: t.muted, fontStyle: 'italic', textAlign: 'center', marginTop: 16 },
  });
}
