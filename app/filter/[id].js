// app/filter/[id].js — Filter Detail (minimal for now; full version next).
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { loadData, saveData, statusOf, markReplaced, deleteFilter, FILTER_TYPES } from '../../data/store';
import { TypeIcon } from '../../theme/Icons';

export default function FilterDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, []));

  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const f = data.filters.find(x => x.id === id);
  if (!f) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 22 }}>
      <Pressable onPress={() => router.back()}><Text style={{ color: t.inkSoft, fontSize: 15 }}>‹ Back</Text></Pressable>
      <Text style={{ color: t.ink, marginTop: 20 }}>Filter not found.</Text>
    </SafeAreaView>
  );

  const status = statusOf(f);
  const tone = t.status[status.key];
  const asset = data.assets.find(a => a.id === f.assetId);
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const onReplace = async () => { const n = markReplaced(data, f.id); setData(n); await saveData(n); };
  const onDelete = async () => { const n = deleteFilter(data, f.id); await saveData(n); router.back(); };

  const s = makeStyles(t);
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 22 }}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
        <View style={s.bigChip}><TypeIcon type={f.type} size={30} color={t.iconInk} /></View>
        <Text style={s.title}>{f.name}</Text>
        <View style={[s.pill, { backgroundColor: tone.pillBg, alignSelf: 'flex-start', marginTop: 8 }]}>
          <Text style={[s.pillTxt, { color: tone.pillInk }]}>{status.label}</Text>
        </View>
        <View style={s.rows}>
          <Row t={t} k="Location" v={asset?.name || '—'} />
          <Row t={t} k="Type" v={FILTER_TYPES[f.type]?.label || 'Other'} />
          <Row t={t} k="Replace every" v={`${f.intervalDays} days`} />
          <Row t={t} k="Last replaced" v={fmt(f.lastReplaced)} />
          <Row t={t} k="Next due" v={fmt(status.due)} />
          <Row t={t} k="Part / reorder" v={f.reorderUrl || '—'} last />
        </View>
        <Pressable style={s.bigBtn} onPress={onReplace}><Text style={s.bigBtnTxt}>✓ Mark Replaced Today</Text></Pressable>
        <Pressable style={s.delBtn} onPress={onDelete}><Text style={s.delTxt}>Delete filter</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ t, k, v, last }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      <Text style={{ color: t.muted, fontSize: 14 }}>{k}</Text>
      <Text style={{ color: t.ink, fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    back: { color: t.inkSoft, fontSize: 15 },
    bigChip: { width: 60, height: 60, borderRadius: 16, backgroundColor: t.iconBg, borderWidth: 1.5, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    bigGlyph: { fontSize: 30, color: t.iconInk },
    title: { ...t.type.title, fontSize: 28, color: t.ink, marginTop: 14 },
    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: t.radius.pill },
    pillTxt: { ...t.type.pill },
    rows: { marginTop: 22, backgroundColor: t.card, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: t.line },
    bigBtn: { marginTop: 22, backgroundColor: t.btnBg, padding: 16, borderRadius: t.radius.btn, alignItems: 'center' },
    bigBtnTxt: { ...t.type.btn, color: t.btnInk },
    delBtn: { marginTop: 18, padding: 12, alignItems: 'center' },
    delTxt: { color: '#dc2626', fontSize: 14 },
  });
}
