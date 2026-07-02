// app/settings/filters.js — Filters (replaceable items inventory).
//
// Same alignment principle as Settings: chevron at x=18 (card edge),
// title indented to line up with card interior text.
// (Card padding is 14 here, vs 16 in Settings, hence the different indent.)

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import { loadData, filtersList, isFilterLow, devicesUsingFilter } from '../../data/store';
import useFixScrollToTop from '../../lib/useFixScrollToTop';

export default function FiltersInventory() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollsToTop = useFixScrollToTop();
  const [data, setData] = useState(null);

  // Hug-then-pin Add button (see assets.js for the rationale).
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [footerH, setFooterH] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, []));

  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const filters = filtersList(data);
  const lowCount = filters.filter(isFilterLow).length;
  const overflow = viewportH > 0 && contentH > viewportH;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        scrollsToTop={scrollsToTop}
        onLayout={e => setViewportH(e.nativeEvent.layout.height)}
        onContentSizeChange={(w, h) => setContentH(h)}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: (overflow ? footerH : 0) + 16 }}
      >
        <Text style={s.title}>Filters</Text>
        <Text style={s.sub}>
          {filters.length === 0
            ? 'No filters yet. Add one to track reorders and on-hand stock.'
            : `${filters.length} filter${filters.length > 1 ? 's' : ''}` + (lowCount ? ` · ${lowCount} low stock` : '')}
        </Text>

        <View style={{ marginTop: 16 }}>
          {filters.map(p => {
            const low = isFilterLow(p);
            const using = devicesUsingFilter(data, p.id).length;
            return (
              <Pressable key={p.id} style={s.row} onPress={() => router.push(`/filter/${p.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName} numberOfLines={1}>{p.name || 'Untitled filter'}</Text>
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

        {!overflow && (
          <Pressable style={[s.addBtn, s.addBtnInline]} onPress={() => router.push('/filter/new')}>
            <Text style={s.addBtnTxt}>+ Add filter</Text>
          </Pressable>
        )}
      </ScrollView>

      {overflow && (
        <View
          style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onLayout={e => setFooterH(e.nativeEvent.layout.height)}
        >
          <Pressable style={s.addBtn} onPress={() => router.push('/filter/new')}>
            <Text style={s.addBtnTxt}>+ Add filter</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },
    // Title indented by card's interior padding (14) to align with card text.
    title: { ...t.type.title, fontSize: t.uit(26), color: t.ink, marginTop: 4, paddingLeft: 14 },
    sub: { fontSize: t.uit(13), color: t.muted, marginTop: 4, paddingLeft: 14 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 14, marginBottom: 10, gap: 10 },
    rowName: { fontSize: t.uit(15), fontWeight: '600', color: t.ink },
    rowMeta: { fontSize: t.uit(12), color: t.muted, marginTop: 3 },
    lowPill: { backgroundColor: t.status.amb.pillBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    lowPillTxt: { color: t.status.amb.pillInk, fontSize: t.uit(11), fontWeight: '700' },
    chev: { fontSize: t.uit(22), color: t.muted },

    // Matches the "Mark Replaced" / Add buttons on Categories & Assets:
    // grey fill, no border, bold black.
    addBtn: {
      padding: 14,
      borderRadius: t.radius.btn,
      backgroundColor: t.tabIdleBg,
      alignItems: 'center',
    },
    addBtnInline: { marginTop: 6 },
    addBtnTxt: { fontSize: t.uit(15), fontWeight: '700', color: t.ink },

    // Pinned footer bar (opaque so the list scrolls behind it cleanly).
    footer: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      backgroundColor: t.bg,
      paddingHorizontal: 18,
      paddingTop: 10,
    },
  });
}