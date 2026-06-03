// app/filter/new.js — New Filter.
// Modal page: extra top padding to clear iOS modal chrome edge.
// Title indented to match Settings/Edit Filter alignment.
//
// Keyboard handling: KeyboardAwareScrollView (react-native-keyboard-controller)
// scrolls the focused input clear of the keyboard. Requires <KeyboardProvider>
// in app/_layout.js. Native module — needs a dev rebuild to take effect.

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
      notes: '',
    });
    await saveData(next);
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
        <PillButton label="Save" onPress={onSave} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>New Filter</Text>
        <Text style={s.sub}>Set up a replacement schedule and link an optional part.</Text>

        <Text style={s.label}>TYPE</Text>
        <View style={s.typeRow}>
          {Object.entries(FILTER_TYPES).map(([k, v]) => {
            const on = type === k;
            return (
              <Pressable key={k} onPress={() => setType(k)} style={[s.typeChip, on && s.typeChipOn]}>
                <Text style={[s.typeLabel, on && s.typeLabelOn]}>{v.label}</Text>
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
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{a.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>PART (optional)</Text>
        <View style={s.chipWrap}>
          <Pressable onPress={() => setPartId(null)} style={[s.chip, !partId && s.chipOn]}>
            <Text style={[s.chipTxt, !partId && s.chipTxtOn]}>None</Text>
          </Pressable>
          {parts.map(p => {
            const on = partId === p.id;
            return (
              <Pressable key={p.id} onPress={() => setPartId(p.id)} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{p.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.hint}>You can also create a new part from the filter detail later.</Text>
      </KeyboardAwareScrollView>
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
    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
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
    hint: { fontSize: 12, color: t.muted, marginTop: 10 },
  });
}