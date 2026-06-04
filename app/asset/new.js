// app/asset/new.js — New Asset.
//
// Mirrors app/part/new.js, for the "+ Add asset" button on the Choose Asset
// picker. Assets need a name and a category (same rules the Assets settings
// screen enforces: name required, no duplicate active name, category required).
//
// Two ways in (matching New Part):
//   - From the Choose Asset picker on Edit Filter ("+ Add asset"): filterId is
//     set. New Asset is stacked ON TOP of the picker. On Save we link the asset
//     to the filter, hand its id back to Edit Filter via pendingPick, and pop
//     BOTH this screen and the picker (dismiss(2)) so we land straight on Edit
//     Filter with the new asset selected. Cancel pops one level, back to the
//     picker.
//   - Without a filterId (not currently wired anywhere, but kept symmetric):
//     Save/Cancel just pop one level.
//
// Category is chosen with inline chips, same as the Add Asset dialog on the
// settings screen — categories are few (MAX_CATEGORIES = 8) so chips wrap to
// at most two lines.

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { PillButton } from '../../components/HeaderBits';
import { loadData, saveData, addAsset, updateFilter } from '../../data/store';
import { setPendingPick } from '../../lib/pendingPick';

export default function NewAsset() {
  const t = useTheme();
  const router = useRouter();
  const { filterId } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [catId, setCatId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData().then(d => {
      setData(d);
      const cats = (d.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      if (cats[0]) setCatId(cats[0].id);
    });
  }, []);

  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const categories = (data.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    if (!catId) { setError('Please pick a category.'); return; }
    const exists = (data.assets || []).some(
      a => !a.archived && a.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) { setError('An asset with that name already exists.'); return; }

    let next = addAsset(data, { name: trimmed, categoryId: catId });
    const newAsset = next.assets[next.assets.length - 1];
    if (filterId) next = updateFilter(next, filterId, { assetId: newAsset.id });
    await saveData(next);

    if (filterId) {
      // Came from the Choose Asset picker (stack: Edit Filter → picker → here).
      // Hand the new asset back to Edit Filter, then pop this screen AND the
      // picker beneath it in one motion so we land straight on Edit Filter.
      setPendingPick({ field: 'asset', value: newAsset.id });
      router.dismiss(2);
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
        <PillButton label="Save" onPress={save} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>New Asset</Text>
        <Text style={s.sub}>Add a home, car, office, or other place with filters.</Text>

        <Text style={s.label}>NAME</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={(v) => { setName(v); if (error) setError(null); }}
          placeholder="e.g. Main House"
          placeholderTextColor={t.muted}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <Text style={s.label}>CATEGORY</Text>
        <View style={s.chipWrap}>
          {categories.map(c => {
            const on = catId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => { setCatId(c.id); if (error) setError(null); }}
                style={[s.chip, on && s.chipOn]}
              >
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {!!error && <Text style={s.errorTxt}>{error}</Text>}

        {!!filterId && <Text style={[s.hint, { marginTop: 16 }]}>This asset will be linked to the filter you came from.</Text>}
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
    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 13 },
    input: { padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },
    hint: { fontSize: 12, color: t.muted, marginTop: 8, paddingLeft: 13 },

    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 13 },
    chip: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
      borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card,
    },
    chipOn: { backgroundColor: t.tabIdleBg, borderColor: t.ink },
    chipTxt: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    chipTxtOn: { color: t.ink, fontWeight: '700' },

    errorTxt: { fontSize: 13, color: '#b3261e', marginTop: 12, paddingLeft: 13 },
  });
}