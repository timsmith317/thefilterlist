// app/settings/assets-archived.js
//
// Archived assets list. Tap any row to open an Actions sheet with
// Restore / Delete / Cancel — this gates the destructive Delete behind
// an extra tap so it can't be triggered by a fat-finger on the list.
// Each option still runs through its own confirmation alert.
//
// A "Delete all" button sits at the bottom (hug-then-pin, like the other
// settings screens) for clearing the whole archive at once. It runs the
// same destructive confirmation as the per-item delete.

import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import {
  loadData, saveData,
  setAssetArchived,
  deleteAsset,
  devicesForAsset,
} from '../../data/store';

export default function ArchivedAssetsSettings() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);

  // Hug-then-pin "Delete all" button (matches the other settings screens):
  // inline while the list fits, pinned to the bottom once it overflows.
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

  const archived = (data.assets || [])
    .filter(a => a.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
  const categories = ((data.categories || [])).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  const overflow = viewportH > 0 && contentH > viewportH;

  const persist = async (next) => {
    setData(next);
    await saveData(next);
  };

  // Step 1: Tap row → choose action. Each option below routes to its own
  // confirmation handler so the destructive Delete is still double-confirmed.
  const onActions = (asset) => {
    Alert.alert(
      asset.name,
      'Choose an action:',
      [
        { text: 'Restore', onPress: () => onUnarchive(asset) },
        { text: 'Delete',  style: 'destructive', onPress: () => onDelete(asset) },
        { text: 'Cancel',  style: 'cancel' },
      ]
    );
  };

  // Step 2a: Restore — confirm + restore.
  const onUnarchive = (asset) => {
    const deviceCount = devicesForAsset(data, asset.id).length;
    const msg = deviceCount > 0
      ? `Restore "${asset.name}"? Its ${deviceCount} device${deviceCount === 1 ? '' : 's'} will be visible again.`
      : `Restore "${asset.name}"?`;
    Alert.alert('Restore Asset', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          const next = setAssetArchived(data, asset.id, false);
          await persist(next);
        },
      },
    ]);
  };

  // Step 2b: Delete — destructive confirm + delete (asset + its devices).
  const onDelete = (asset) => {
    const deviceCount = devicesForAsset(data, asset.id).length;
    const headline = deviceCount > 0
      ? `Delete "${asset.name}" and its ${deviceCount} device${deviceCount === 1 ? '' : 's'}?`
      : `Delete "${asset.name}"?`;
    const msg = `${headline}\n\nBack up your data first if needed — this cannot be undone.`;
    Alert.alert('Delete Forever', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const next = deleteAsset(data, asset.id);
          await persist(next);
        },
      },
    ]);
  };

  // Delete everything in the archive at once — same destructive warning,
  // applied across all archived assets (and their devices).
  const onDeleteAll = () => {
    const count = archived.length;
    if (!count) return;
    const totalDevices = archived.reduce((sum, a) => sum + devicesForAsset(data, a.id).length, 0);
    const headline = totalDevices > 0
      ? `Delete all ${count} archived asset${count === 1 ? '' : 's'} and their ${totalDevices} device${totalDevices === 1 ? '' : 's'}?`
      : `Delete all ${count} archived asset${count === 1 ? '' : 's'}?`;
    const msg = `${headline}\n\nBack up your data first if needed — this cannot be undone.`;
    Alert.alert('Delete Forever', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: async () => {
          let next = data;
          for (const a of archived) next = deleteAsset(next, a.id);
          await persist(next);
        },
      },
    ]);
  };

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
        <Text style={s.title}>Archived Assets</Text>
        <Text style={s.sub}>
          Tap an asset to restore it or delete it permanently.
        </Text>

        {archived.length === 0 && (
          <Text style={s.empty}>No archived assets.</Text>
        )}

        {archived.map(asset => {
          const cat = categories.find(c => c.id === asset.categoryId);
          const deviceCount = devicesForAsset(data, asset.id).length;
          return (
            <Pressable
              key={asset.id}
              onPress={() => onActions(asset)}
              style={({ pressed }) => [s.card, pressed && s.cardPressed]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardName} numberOfLines={1}>{asset.name}</Text>
                <Text style={s.cardMeta} numberOfLines={1}>
                  {cat ? cat.name : 'Uncategorized'} · {deviceCount} device{deviceCount === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={s.chev}>{'\u203A'}</Text>
            </Pressable>
          );
        })}

        {archived.length > 0 && !overflow && (
          <Pressable style={[s.deleteAllBtn, s.deleteAllInline]} onPress={onDeleteAll}>
            <Text style={s.deleteAllTxt}>Delete all</Text>
          </Pressable>
        )}
      </ScrollView>

      {archived.length > 0 && overflow && (
        <View
          style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onLayout={e => setFooterH(e.nativeEvent.layout.height)}
        >
          <Pressable style={s.deleteAllBtn} onPress={onDeleteAll}>
            <Text style={s.deleteAllTxt}>Delete all</Text>
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
    // flex:1 bounds the scroll view so a long list scrolls instead of
    // overflowing off-screen (same fix as the other list screens).
    scrollView: { flex: 1 },

    title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16, marginBottom: 22, lineHeight: 18 },

    empty: { fontSize: 13, color: t.muted, fontStyle: 'italic', paddingLeft: 13, paddingVertical: 12 },

    card: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderRadius: 12, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card,
      marginBottom: 10,
      opacity: 0.85, // subtle dim — archived state cue
    },
    cardPressed: { backgroundColor: t.tabIdleBg, opacity: 1 },
    cardName: { fontSize: 16, fontWeight: '700', color: t.ink },
    cardMeta: { fontSize: 13, color: t.muted, marginTop: 3 },
    chev: { fontSize: 22, color: t.muted, paddingLeft: 8 },

    // "Delete all" — same grey-fill shape/behavior as the other big buttons.
    deleteAllBtn: {
      padding: 14,
      borderRadius: t.radius.btn,
      backgroundColor: t.tabIdleBg,
      alignItems: 'center',
    },
    deleteAllInline: { marginTop: 6 },
    deleteAllTxt: { fontSize: 15, fontWeight: '700', color: t.ink },

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
