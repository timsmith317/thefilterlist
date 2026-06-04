// app/category/new.js — New Category.
//
// Matches the look/feel of New Asset (full modal page, not the old centered
// dialog), for the "+ Add category" button on the Categories settings screen.
// Categories only carry a name; rules mirror the old Add dialog: name
// required, no duplicate name, and a cap of MAX_CATEGORIES.
//
// No link-back/pendingPick here — categories aren't selected into anything,
// so Save just adds and pops; Categories reloads on focus and shows the new
// one. (The Categories screen also disables its Add button at the cap, so
// this page normally won't be reached when full; the cap check is a guard.)

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { PillButton } from '../../components/HeaderBits';
import { loadData, saveData, addCategory, MAX_CATEGORIES } from '../../data/store';

export default function NewCategory() {
  const t = useTheme();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => { loadData().then(setData); }, []);

  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const count = (data.categories || []).length;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    if (count >= MAX_CATEGORIES) { setError(`You can have up to ${MAX_CATEGORIES} categories.`); return; }
    const exists = (data.categories || []).some(
      c => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) { setError('A category with that name already exists.'); return; }

    const next = addCategory(data, trimmed);
    await saveData(next);
    router.back();
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
        <Text style={s.title}>New Category</Text>
        <Text style={s.sub}>{count} of {MAX_CATEGORIES} categories used.</Text>

        <Text style={s.label}>NAME</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={(v) => { setName(v); if (error) setError(null); }}
          placeholder="e.g. Garage"
          placeholderTextColor={t.muted}
          autoCapitalize="words"
          autoCorrect={false}
        />

        {!!error && <Text style={s.errorTxt}>{error}</Text>}
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
    errorTxt: { fontSize: 13, color: '#b3261e', marginTop: 12, paddingLeft: 13 },
  });
}