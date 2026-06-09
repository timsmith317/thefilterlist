// app/asset/new.js — New Asset.
//
// For the "+ Add asset" button on the Choose Asset picker. Assets need only a
// name now (categories were removed — assets are the single org dimension).
//
// Two ways in (matching New Filter):
//   - From the Choose Asset picker on a device editor ("+ Add asset"): deviceId
//     is set. New Asset stacks ON TOP of the picker. On Save we link the asset
//     to the device, hand its id back via pendingPick, and pop BOTH this screen
//     and the picker (dismiss(2)). Cancel pops one level, back to the picker.
//   - Without a deviceId: Save/Cancel just pop one level.

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { PillButton } from '../../components/HeaderBits';
import { loadData, saveData, addAsset, updateDevice } from '../../data/store';
import { setPendingPick } from '../../lib/pendingPick';

export default function NewAsset() {
  const t = useTheme();
  const router = useRouter();
  const { deviceId } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => { loadData().then(setData); }, []);

  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    const exists = (data.assets || []).some(
      a => !a.archived && a.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) { setError('An asset with that name already exists.'); return; }

    let next = addAsset(data, { name: trimmed });
    const newAsset = next.assets[next.assets.length - 1];
    if (deviceId) next = updateDevice(next, deviceId, { assetId: newAsset.id });
    await saveData(next);

    if (deviceId) {
      // Stack: device editor → Choose Asset picker → here. Hand the new asset
      // back and pop this screen AND the picker in one motion.
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
        <Text style={s.sub}>Add a home, car, office, or other place with devices.</Text>

        <Text style={s.label}>NAME</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={(v) => { setName(v); if (error) setError(null); }}
          placeholder="e.g. House"
          placeholderTextColor={t.muted}
          autoCapitalize="words"
          autoCorrect={false}
        />

        {!!error && <Text style={s.errorTxt}>{error}</Text>}

        {!!deviceId && <Text style={[s.hint, { marginTop: 16 }]}>This asset will be linked to the device you came from.</Text>}
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
    input: { height: 50, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },
    hint: { fontSize: 12, color: t.muted, marginTop: 8, paddingLeft: 13 },
    errorTxt: { fontSize: 13, color: '#b3261e', marginTop: 12, paddingLeft: 13 },
  });
}