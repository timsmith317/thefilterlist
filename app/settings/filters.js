// app/settings/filters.js — Filters inventory.
//
// The one place to see and manage EVERY filter, regardless of which asset
// it belongs to or whether that asset is archived. Tap a row to open the
// filter detail (edit / mark replaced / notes); the bottom button adds a
// new one (filter/new.js has its own asset picker, so no asset needs to be
// pre-selected here).
//
// Add button uses the same hug-then-pin behavior as the other list screens.

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import { loadData, statusOf } from '../../data/store';

export default function FiltersInventory() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);

  // Hug-then-pin Add button (matches the other settings screens).
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

  const assetsById = Object.fromEntries((data.assets || []).map(a => [a.id, a]));
  // Every filter, sorted alphabetically by name.
  const filters = (data.filters || [])
    .map(f => {
      const asset = assetsById[f.assetId];
      return { ...f, asset, archived: !asset || !!asset.archived, status: statusOf(f) };
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const overflow = viewportH > 0 && contentH > viewportH;

  const statusColors = (key) =>
    (t.status && t.status[key]) || { pillBg: t.tabIdleBg, pillInk: t.ink };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>

      <ScrollView
        style={s.scrollView}
        onLayout={e => setViewportH(e.nativeEvent.layout.height)}
        onContentSizeChange={(w, h) => setContentH(h)}
        contentContainerStyle={[s.scroll, { paddingBottom: (overflow ? footerH : 0) + 16 }]}
      >
        <Text style={s.title}>Filters</Text>
        <Text style={s.sub}>
          {filters.length === 0
            ? 'No filters yet. Add one to start tracking replacements.'
            : `${filters.length} filter${filters.length === 1 ? '' : 's'} across your assets.`}
        </Text>

        <View style={{ marginTop: 16 }}>
          {filters.map(f => {
            const c = statusColors(f.status.key);
            return (
              <Pressable
                key={f.id}
                onPress={() => router.push(`/filter/${f.id}`)}
                style={({ pressed }) => [s.card, f.archived && s.cardArchived, pressed && s.cardPressed]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.cardName} numberOfLines={1}>{f.name || 'Untitled filter'}</Text>
                  <Text style={s.cardMeta} numberOfLines={1}>
                    {f.asset ? f.asset.name : 'No asset'}{f.archived ? ' · Archived' : ''} · every {f.intervalDays}d
                  </Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: c.pillBg }]}>
                  <Text style={[s.statusPillTxt, { color: c.pillInk }]} numberOfLines={1}>
                    {f.status.label}
                  </Text>
                </View>
                <Text style={s.chev}>{'\u203A'}</Text>
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
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6,
    },
    scroll: { paddingHorizontal: 18, paddingBottom: 40 },
    scrollView: { flex: 1 },

    title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16, lineHeight: 18 },

    card: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderRadius: 12, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card,
      marginBottom: 10,
    },
    cardArchived: { opacity: 0.6 },
    cardPressed: { backgroundColor: t.tabIdleBg },
    cardName: { fontSize: 16, fontWeight: '700', color: t.ink },
    cardMeta: { fontSize: 13, color: t.muted, marginTop: 3 },

    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 8 },
    statusPillTxt: { fontSize: 11, fontWeight: '700' },

    chev: { fontSize: 22, color: t.muted, paddingLeft: 8 },

    // Matches the Add buttons on the other settings screens.
    addBtn: {
      padding: 14,
      borderRadius: t.radius.btn,
      backgroundColor: t.tabIdleBg,
      alignItems: 'center',
    },
    addBtnInline: { marginTop: 6 },
    addBtnTxt: { fontSize: 15, fontWeight: '700', color: t.ink },

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
