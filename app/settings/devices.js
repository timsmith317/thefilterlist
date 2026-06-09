// app/settings/devices.js — Devices inventory.
//
// The place to see and manage your live devices across every asset. Tap a
// row to open the device detail (edit / mark replaced / notes); the bottom
// button adds a new one (device/new.js has its own asset picker, so no asset
// needs to be pre-selected here).
//
// Devices whose asset is archived are hidden here (same as the home and
// category views). Unarchiving the asset brings its devices back — nothing
// is deleted, this is just a computed view.
//
// Add button uses the same hug-then-pin behavior as the other list screens.

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import { loadData, statusOf } from '../../data/store';

export default function DevicesInventory() {
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
  // Live devices only — those whose asset exists and isn't archived —
  // sorted alphabetically by name. Archived-asset devices are hidden here
  // (they return when the asset is unarchived).
  const devices = (data.devices || [])
    .map(f => {
      const asset = assetsById[f.assetId];
      return { ...f, asset, archived: !asset || !!asset.archived, status: statusOf(f, data) };
    })
    .filter(f => !f.archived)
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
        <Text style={s.title}>Devices</Text>
        <Text style={s.sub}>
          {devices.length === 0
            ? 'No devices yet. Add one to start tracking replacements.'
            : `${devices.length} device${devices.length === 1 ? '' : 's'} across your assets.`}
        </Text>

        <View style={{ marginTop: 16 }}>
          {devices.map(f => {
            const c = statusColors(f.status.key);
            const noFilters = f.status.stageCount === 0;
            return (
              <Pressable
                key={f.id}
                onPress={() => router.push(`/device/${f.id}`)}
                style={({ pressed }) => [s.card, pressed && s.cardPressed]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.cardName} numberOfLines={1}>{f.name || 'Untitled device'}</Text>
                  <Text style={s.cardMeta} numberOfLines={1}>
                    {f.asset.name}{noFilters ? '' : ` · every ${f.intervalDays}d`}
                  </Text>
                </View>
                {!noFilters && (
                  <View style={[s.statusPill, { backgroundColor: c.pillBg }]}>
                    <Text style={[s.statusPillTxt, { color: c.pillInk }]} numberOfLines={1}>
                      {f.status.label}
                    </Text>
                  </View>
                )}
                <Text style={s.chev}>{'\u203A'}</Text>
              </Pressable>
            );
          })}
        </View>

        {!overflow && (
          <Pressable style={[s.addBtn, s.addBtnInline]} onPress={() => router.push('/device/new')}>
            <Text style={s.addBtnTxt}>+ Add device</Text>
          </Pressable>
        )}
      </ScrollView>

      {overflow && (
        <View
          style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onLayout={e => setFooterH(e.nativeEvent.layout.height)}
        >
          <Pressable style={s.addBtn} onPress={() => router.push('/device/new')}>
            <Text style={s.addBtnTxt}>+ Add device</Text>
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