// app/settings/parts.js — Parts inventory under Settings.
// Removed SETTINGS kicker. + Add uses the pill style matching Settings/Edit.

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton, PillButton } from '../../components/HeaderBits';
import { loadData, partsList, isPartLow, filtersUsingPart } from '../../data/store';

export default function PartsInventory() {
  const t = useTheme();
  const router = useRouter();
  const [data, setData] = useState(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, []));

  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const parts = partsList(data);
  const lowCount = parts.filter(isPartLow).length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <PillButton label="+ Add" onPress={() => router.push('/part/new')} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        <Text style={s.title}>Parts Inventory</Text>
        <Text style={s.sub}>
          {parts.length === 0
            ? 'No parts yet. Add one to track reorders and on-hand stock.'
            : `${parts.length} part${parts.length > 1 ? 's' : ''}` + (lowCount ? ` · ${lowCount} low stock` : '')}
        </Text>

        <View style={{ marginTop: 16 }}>
          {parts.map(p => {
            const low = isPartLow(p);
            const using = filtersUsingPart(data, p.id).length;
            return (
              <Pressable key={p.id} style={s.row} onPress={() => router.push(`/part/${p.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName} numberOfLines={1}>{p.name || 'Untitled part'}</Text>
                  <Text style={s.rowMeta}>
                    {p.sku ? `SKU ${p.sku} · ` : ''}On hand: {p.onHand} · used by {using}
                  </Text>
                </View>
                {low && <View style={s.lowPill}><Text style={s.lowPillTxt}>Low</Text></View>}
                <Text style={s.chev}>›</Text>
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
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
    title: { ...t.type.title, fontSize: 26, color: t.ink, marginTop: 4 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 14, marginBottom: 10, gap: 10 },
    rowName: { fontSize: 15, fontWeight: '600', color: t.ink },
    rowMeta: { fontSize: 12, color: t.muted, marginTop: 3 },
    lowPill: { backgroundColor: t.status.amb.pillBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    lowPillTxt: { color: t.status.amb.pillInk, fontSize: 11, fontWeight: '700' },
    chev: { fontSize: 22, color: t.muted },
  });
}
