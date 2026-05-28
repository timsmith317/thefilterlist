// app/filter/new.js — Add a new filter. Save uses the pill style.

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { PillButton } from '../../components/HeaderBits';
import { loadData, saveData, addFilter, FILTER_TYPES, partsList } from '../../data/store';

export default function NewFilter() {
  const t = useTheme();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('air');
  const [interval, setInterval] = useState('90');
  const [assetId, setAssetId] = useState(null);
  const [partId, setPartId] = useState(null);

  useEffect(() => { loadData().then(d => {
    setData(d);
    const live = d.assets.find(a => !a.archived);
    if (live) setAssetId(live.id);
  }); }, []);

  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const liveAssets = data.assets.filter(a => !a.archived);
  const parts = partsList(data);
  const s = makeStyles(t);

  const onSave = async () => {
    const next = addFilter(data, {
      assetId: assetId || liveAssets[0]?.id,
      name: (name.trim() || FILTER_TYPES[type].label + ' Filter'),
      type,
      intervalDays: Math.max(1, parseInt(interval, 10) || 90),
      lastReplaced: new Date().toISOString(),
      partId: partId || null,
      photo: null,
    });
    await saveData(next);
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.link}>Cancel</Text></Pressable>
        <Text style={s.kicker}>NEW FILTER</Text>
        <PillButton label="Save" primary onPress={onSave} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 22 }}>
        <Text style={s.label}>TYPE</Text>
        <View style={s.typeRow}>
          {Object.entries(FILTER_TYPES).map(([k, v]) => {
            const on = type === k;
            return (
              <Pressable key={k} onPress={() => setType(k)} style={[s.typeChip, on && s.typeChipOn]}>
                <Text style={[s.typeLabel, on && { color: t.btnInk }]}>{v.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>NAME</Text>
        <TextInput style={s.input} placeholder={FILTER_TYPES[type].label + ' Filter'} placeholderTextColor={t.muted} value={name} onChangeText={setName} />

        <Text style={s.label}>INTERVAL (days)</Text>
        <TextInput style={s.input} keyboardType="number-pad" value={interval} onChangeText={(v) => setInterval(v.replace(/[^0-9]/g, ''))} placeholderTextColor={t.muted} />

        <Text style={s.label}>ASSET</Text>
        <View style={s.chipWrap}>
          {liveAssets.map(a => {
            const on = assetId === a.id;
            return (
              <Pressable key={a.id} onPress={() => setAssetId(a.id)} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipTxt, on && { color: t.btnInk }]}>{a.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>PART (optional)</Text>
        <View style={s.chipWrap}>
          <Pressable onPress={() => setPartId(null)} style={[s.chip, !partId && s.chipOn]}>
            <Text style={[s.chipTxt, !partId && { color: t.btnInk }]}>None</Text>
          </Pressable>
          {parts.map(p => {
            const on = partId === p.id;
            return (
              <Pressable key={p.id} onPress={() => setPartId(p.id)} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipTxt, on && { color: t.btnInk }]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.hint}>You can also create a new part from the filter detail later.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 6 },
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
    hint: { fontSize: 12, color: t.muted, marginTop: 10 },
  });
}
