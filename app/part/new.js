// app/part/new.js — Add a new part. Optional filterId query param links the
// newly-created part to that filter on save (used from Filter Detail's
// "+ Add a part" call-to-action).

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { loadData, saveData, addPart, updateFilter } from '../../data/store';

export default function NewPart() {
  const t = useTheme();
  const router = useRouter();
  const { filterId } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [reorderUrl, setReorderUrl] = useState('');
  const [onHand, setOnHand] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('1');

  useEffect(() => { loadData().then(setData); }, []);
  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const save = async () => {
    let next = addPart(data, {
      name: name.trim() || 'Untitled part',
      sku: sku.trim(),
      reorderUrl: reorderUrl.trim(),
      onHand: Math.max(0, parseInt(onHand, 10) || 0),
      lowStockThreshold: Math.max(0, parseInt(lowStockThreshold, 10) || 0),
    });
    const newPart = next.parts[next.parts.length - 1];
    if (filterId) next = updateFilter(next, filterId, { partId: newPart.id });
    await saveData(next);
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.link}>Cancel</Text></Pressable>
        <Text style={s.kicker}>NEW PART</Text>
        <Pressable onPress={save} hitSlop={10}><Text style={[s.link, { color: t.ink, fontWeight: '700' }]}>Save</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 22 }}>
        <Text style={s.label}>NAME</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. 20x25x1 MERV 11" placeholderTextColor={t.muted} />

        <Text style={s.label}>SKU</Text>
        <TextInput style={s.input} value={sku} onChangeText={setSku} placeholder="e.g. EDR1RXD1" placeholderTextColor={t.muted} autoCapitalize="characters" />

        <Text style={s.label}>REORDER URL</Text>
        <TextInput style={s.input} value={reorderUrl} onChangeText={setReorderUrl} placeholder="https://..." placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>ON HAND</Text>
            <TextInput style={s.input} value={onHand} onChangeText={(v) => setOnHand(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>LOW-STOCK AT</Text>
            <TextInput style={s.input} value={lowStockThreshold} onChangeText={(v) => setLowStockThreshold(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
          </View>
        </View>
        <Text style={s.hint}>You'll get a low-stock alert when on-hand reaches this number.</Text>

        {!!filterId && <Text style={[s.hint, { marginTop: 16 }]}>This part will be linked to the filter you came from.</Text>}
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
    hint: { fontSize: 12, color: t.muted, marginTop: 8 },
  });
}
