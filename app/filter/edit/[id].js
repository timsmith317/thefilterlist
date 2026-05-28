// app/filter/edit/[id].js — Edit Filter.
//
// Labels indented (paddingLeft: 13) to align with input text inside each
// input box. Same fix as New Part.

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../theme/theme';
import { PillButton } from '../../../components/HeaderBits';
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
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
        <PillButton label="Save" onPress={save} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        <Text style={s.title}>Edit Filter</Text>
        <Text style={s.sub}>Change schedule, type, location, or linked part.</Text>

        <Text style={s.label}>TYPE</Text>
        <View style={s.typeRow}>
          {Object.entries(FILTER_TYPES).map(([k, v]) => {
            const on = draft.type === k;
            return (
              <Pressable key={k} onPress={() => setDraft({ ...draft, type: k })} style={[s.typeChip, on && s.typeChipOn]}>
                <Text style={[s.typeLabel, on && s.typeLabelOn]}>{v.label}</Text>
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
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{a.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>PART</Text>
        <View style={s.chipWrap}>
          <Pressable onPress={() => setDraft({ ...draft, partId: null })} style={[s.chip, !draft.partId && s.chipOn]}>
            <Text style={[s.chipTxt, !draft.partId && s.chipTxtOn]}>None</Text>
          </Pressable>
          {parts.map(p => {
            const on = draft.partId === p.id;
            return (
              <Pressable key={p.id} onPress={() => setDraft({ ...draft, partId: p.id })} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.hint}>To add a new part, go to Settings → Parts Inventory.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 22, paddingBottom: 6 },
    cancel: { color: t.inkSoft, fontSize: 15 },
    title: { ...t.type.title, fontSize: 26, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16 },
    // Labels indented to align with text inside inputs (input has padding: 13).
    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 13 },
    input: { padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: t.radius.chip, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    typeChipOn: { backgroundColor: t.tabIdleBg },
    typeLabel: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    typeLabelOn: { color: t.ink, fontWeight: '700' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    chipOn: { backgroundColor: t.tabIdleBg },
    chipTxt: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    chipTxtOn: { color: t.ink, fontWeight: '700' },
    hint: { fontSize: 12, color: t.muted, marginTop: 10, paddingLeft: 13 },
  });
}
