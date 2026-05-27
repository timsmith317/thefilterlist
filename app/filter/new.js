// app/filter/new.js — Add Filter (create), themed and wired to the store.
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { loadData, saveData, addFilter, FILTER_TYPES } from '../../data/store';

export default function NewFilter() {
  const t = useTheme();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('air');
  const [interval, setInterval] = useState('90');
  const [assetId, setAssetId] = useState(null);
  const [reorderUrl, setReorderUrl] = useState('');

  useEffect(() => { loadData().then(d => { setData(d); if (d.assets[0]) setAssetId(d.assets.find(a=>!a.archived)?.id || d.assets[0].id); }); }, []);

  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const liveAssets = data.assets.filter(a => !a.archived);
  const s = makeStyles(t);

  const onSave = async () => {
    const next = addFilter(data, {
      assetId: assetId || liveAssets[0]?.id,
      name: name || FILTER_TYPES[type].label + ' Filter',
      type, intervalDays: Number(interval) || 90,
      lastReplaced: new Date().toISOString(), reorderUrl, photo: null,
    });
    await saveData(next);
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()}><Text style={s.link}>Cancel</Text></Pressable>
        <Text style={s.kicker}>NEW FILTER</Text>
        <Pressable onPress={onSave}><Text style={[s.link, { color: t.ink, fontWeight: '700' }]}>Save</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 22 }}>
        <Text style={s.label}>TYPE</Text>
        <View style={s.typeRow}>
          {Object.entries(FILTER_TYPES).map(([k, v]) => {
            const on = type === k;
            return (
              <Pressable key={k} onPress={() => setType(k)} style={[s.typeChip, on && s.typeChipOn]}>
                <Text style={[s.typeGlyph, on && { color: t.btnInk }]}>{v.icon}</Text>
                <Text style={[s.typeLabel, on && { color: t.btnInk }]}>{v.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>NAME</Text>
        <TextInput style={s.input} placeholder={FILTER_TYPES[type].label + ' Filter'} placeholderTextColor={t.muted} value={name} onChangeText={setName} />

        <Text style={s.label}>INTERVAL (days)</Text>
        <TextInput style={s.input} keyboardType="number-pad" value={interval} onChangeText={setInterval} placeholderTextColor={t.muted} />

        <Text style={s.label}>ASSET</Text>
        <View style={s.assetWrap}>
          {liveAssets.map(a => {
            const on = assetId === a.id;
            return (
              <Pressable key={a.id} onPress={() => setAssetId(a.id)} style={[s.assetChip, on && s.assetChipOn]}>
                <Text style={[s.assetTxt, on && { color: t.btnInk }]}>{a.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>REORDER URL (optional)</Text>
        <TextInput style={s.input} placeholder="https://..." autoCapitalize="none" placeholderTextColor={t.muted} value={reorderUrl} onChangeText={setReorderUrl} />
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
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 14, borderRadius: t.radius.chip, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    typeChipOn: { backgroundColor: t.btnBg, borderColor: t.btnBg },
    typeGlyph: { fontSize: 22, color: t.iconInk },
    typeLabel: { fontSize: 12, fontWeight: '600', color: t.inkSoft },
    input: { padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },
    assetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    assetChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    assetChipOn: { backgroundColor: t.btnBg, borderColor: t.btnBg },
    assetTxt: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
  });
}
