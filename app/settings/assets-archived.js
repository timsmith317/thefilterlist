// app/settings/assets-archived.js
//
// Archived assets list. Tap any row to open an Actions sheet with
// Restore / Delete / Cancel — this gates the destructive Delete behind
// an extra tap so it can't be triggered by a fat-finger on the list.
// Each option still runs through its own confirmation alert.

import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import {
  loadData, saveData,
  setAssetArchived,
  deleteAsset,
  filtersForAsset,
} from '../../data/store';

export default function ArchivedAssetsSettings() {
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

  const archived = (data.assets || [])
    .filter(a => a.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
  const categories = ((data.categories || [])).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

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
    const filterCount = filtersForAsset(data, asset.id).length;
    const msg = filterCount > 0
      ? `Restore "${asset.name}"? Its ${filterCount} filter${filterCount === 1 ? '' : 's'} will be visible again.`
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

  // Step 2b: Delete — destructive confirm + delete (asset + its filters).
  const onDelete = (asset) => {
    const filterCount = filtersForAsset(data, asset.id).length;
    const headline = filterCount > 0
      ? `Delete "${asset.name}" and its ${filterCount} filter${filterCount === 1 ? '' : 's'}?`
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

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Archived Assets</Text>
        <Text style={s.sub}>
          Tap an asset to restore it or delete it permanently.
        </Text>

        {archived.length === 0 && (
          <Text style={s.empty}>No archived assets.</Text>
        )}

        {archived.map(asset => {
          const cat = categories.find(c => c.id === asset.categoryId);
          const filterCount = filtersForAsset(data, asset.id).length;
          return (
            <Pressable
              key={asset.id}
              onPress={() => onActions(asset)}
              style={({ pressed }) => [s.card, pressed && s.cardPressed]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardName} numberOfLines={1}>{asset.name}</Text>
                <Text style={s.cardMeta} numberOfLines={1}>
                  {cat ? cat.name : 'Uncategorized'} · {filterCount} filter{filterCount === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={s.chev}>{'\u203A'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  });
}