// app/filter/edit/[id].js — Edit existing filter.
// Reuses the same form pattern as new.js. v1 minimum: name, type, interval,
// asset, link/unlink part.

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../theme/theme';
import { loadData, saveData, updateFilter, FILTER_TYPES, partsList } from '../../../data/store';

export default function EditFilter() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => { loadData().then(d => {
    setData(d);
    const f = d.filters.find(x => x.id === id);
    if (f) setDraft({ ...f, interval: String(f.intervalDays) });
  }); }, [id]);

  const s = makeStyles(t);
  if (!data || !draft) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const assets = data.assets.filter(a => !a.archived);
  const parts = partsList(data);

  const save = async () => {
    const patch = {
      name: draft.name.trim() || draft.name,
      type: draft.type,
      intervalDays: Math.max(1, parseInt(draft.interval, 10) || 90),
      assetId: draft.assetId,
      partId: draft.partId || null,
    };
    const next = updateFilter(data, id, patch);
    await saveData(next);
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.link}>Cancel</Text></Pressable>
        <Text style={s.kicker}>EDIT FILTER</Text>
        <Pressable onPress={save} hitSlop={10}><Text style={[s.link, { color: t.ink, fontWeight: '700' }]}>Save</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 22 }}>
        <Text style={s.label}>TYPE</Text>
        <View style={s.typeRow}>
          {Object.entries(FILTER_TYPES).map(([k, v]) => {
            const on = draft.type === k;
            return (
              <Pressable key={k} onPress={() => setDraft({ ...draft, type: k })} style={[s.typeChip, on && s.typeChipOn]}>
                <Text style={[s.typeLabel, on && { color: t.btnInk }]}>{v.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>NAME</Text>
        <TextInput style={s.input} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} placeholderTextColor={t.muted} />

        <Text style={s.label}>INTERVAL (days)</Text>
        <TextInput style={s.input} value={draft.interval} onChangeText={(v) => setDraft({ ...draft, interval: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />

        <Text style={s.label}>ASSET</Text>
        <View style={s.chipWrap}>
          {assets.map(a => {
            const on = draft.assetId === a.id;
            return (
              <Pressable key={a.id} onPress={() => setDraft({ ...draft, assetId: a.id })} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipTxt, on && { color: t.btnInk }]}>{a.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>PART (optional)</Text>
        <View style={s.chipWrap}>
          <Pressable onPress={() => setDraft({ ...draft, partId: null })} style={[s.chip, !draft.partId && s.chipOn]}>
            <Text style={[s.chipTxt, !draft.partId && { color: t.btnInk }]}>None</Text>
          </Pressable>
          {parts.map(p => {
            const on = draft.partId === p.id;
            return (
              <Pressable key={p.id} onPress={() => setDraft({ ...draft, partId: p.id })} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipTxt, on && { color: t.btnInk }]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 12 },
    link: { color: t.inkSoft, fontSize: 15 },
    kicker: { ...t.type.kicker, color: t.ink, textTransform: 'uppercase' },
    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
    input: { padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: t.radius.chip, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    typeChipOn: { backgroundColor: t.btnBg, borderColor: t.btnBg },
    typeLabel: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    chipOn: { backgroundColor: t.btnBg, borderColor: t.btnBg },
    chipTxt: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
  });
}
