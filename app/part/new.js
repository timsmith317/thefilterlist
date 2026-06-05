// app/part/new.js — New Part.
// Modal page padding (clears iOS modal chrome edge). Title indented 16 to
// match Settings. Field labels indented 13 to align with input text inside
// each input box.
//
// Two ways in:
//   - From the Parts inventory ("+ Add part"): no stageId. Save/Cancel just
//     pop back to the inventory.
//   - From the Choose Part picker on New/Edit Filter ("+ Add new part"): a
//     stageId is set. New Part is stacked ON TOP of the picker. On Save we
//     create the part, hand its id (plus the stageId) back to the opener via
//     pendingPick, and pop BOTH this screen and the picker (dismiss(2)) so we
//     land straight back on the form with the new part selected for that
//     stage. We do NOT write the link onto a saved filter here — linking is
//     deferred to the form's draft, which persists it on its own Save. Cancel
//     pops one level, back to the picker.
//
// Keyboard handling: KeyboardAwareScrollView (react-native-keyboard-controller)
// scrolls the focused input clear of the keyboard. bottomOffset keeps a little
// breathing room above the keyboard top edge. Requires <KeyboardProvider> in
// app/_layout.js. Native module — needs a dev rebuild to take effect.

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { PillButton } from '../../components/HeaderBits';
import PhotoStrip from '../../components/PhotoStrip';
import IntervalField from '../../components/IntervalField';
import { loadData, saveData, addPart, MAX_PART_PHOTOS } from '../../data/store';
import { intervalToDays } from '../../lib/interval';
import { pickFromLibrary, takePhoto, saveToPhotos, deleteFile } from '../../lib/partPhotos';
import { setPendingPick } from '../../lib/pendingPick';

export default function NewPart() {
  const t = useTheme();
  const router = useRouter();
  const { stageId, multi } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [intervalValue, setIntervalValue] = useState('90');
  const [intervalUnit, setIntervalUnit] = useState('days');
  const [sku, setSku] = useState('');
  const [reorderUrl, setReorderUrl] = useState('');
  const [onHand, setOnHand] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('1');
  const [photos, setPhotos] = useState([]);

  useEffect(() => { loadData().then(setData); }, []);
  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  // How we got here: the Filter editor's multi-select Parts picker (multi),
  // a single stage's part picker (stageId), or the Parts inventory (neither).
  const fromMultiPicker = multi === '1' || multi === 'true';
  const fromStagePicker = !!stageId;
  const fromPicker = fromMultiPicker || fromStagePicker;

  const onCancel = async () => {
    for (const u of photos) await deleteFile(u);
    router.back();
  };

  const save = async () => {
    const next = addPart(data, {
      name: name.trim() || 'Untitled part',
      intervalDays: intervalToDays(intervalValue, intervalUnit),
      sku: sku.trim(),
      reorderUrl: reorderUrl.trim(),
      photos,
      onHand: Math.max(0, parseInt(onHand, 10) || 0),
      lowStockThreshold: Math.max(0, parseInt(lowStockThreshold, 10) || 0),
    });
    const newPart = next.parts[next.parts.length - 1];
    await saveData(next);

    if (fromMultiPicker) {
      // Stack: Filter editor → multi Parts picker → here. Pop back to the
      // picker (one level) and hand it the new id; the picker folds it into
      // its live selection so it lands pre-checked, then Done returns the set.
      setPendingPick({ field: 'addPart', value: newPart.id });
      router.back();
    } else if (fromStagePicker) {
      // Stack: form → single stage picker → here. Hand the new part (and which
      // stage it's for) back to the form, then pop this screen AND the picker
      // so we land straight on the form with the part selected for that stage.
      setPendingPick({ field: 'part', value: newPart.id, stageId });
      router.dismiss(2);
    } else {
      router.back();
    }
  };

  const onPickPhoto = async (source) => {
    if (photos.length >= MAX_PART_PHOTOS) {
      Alert.alert('Limit reached', `Up to ${MAX_PART_PHOTOS} photos.`);
      return;
    }
    const uri = source === 'camera' ? await takePhoto() : await pickFromLibrary();
    if (!uri) return;
    setPhotos(prev => [...prev, uri].slice(0, MAX_PART_PHOTOS));
  };
  const onSaveToPhotos = async (uri) => {
    const ok = await saveToPhotos(uri);
    if (ok) Alert.alert('Saved', 'Photo saved to your library.');
  };
  const onDeletePhoto = async (index) => {
    const uri = photos[index];
    setPhotos(prev => prev.filter((_, i) => i !== index));
    await deleteFile(uri);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={onCancel} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
        <PillButton label="Save" onPress={save} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>New Part</Text>
        <Text style={s.sub}>Track stock and reorder info for this part.</Text>

        <Text style={s.label}>NAME</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. 20x25x1 MERV 11" placeholderTextColor={t.muted} />

        <Text style={s.label}>REPLACE EVERY</Text>
        <IntervalField
          value={intervalValue}
          unit={intervalUnit}
          onChangeValue={setIntervalValue}
          onChangeUnit={setIntervalUnit}
        />
        <Text style={s.hint}>The manufacturer's recommended interval — used everywhere this part is linked.</Text>

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

        <Text style={s.label}>PHOTOS</Text>
        <View style={{ paddingLeft: 13 }}>
          <PhotoStrip
            photos={photos}
            max={MAX_PART_PHOTOS}
            onPick={onPickPhoto}
            onSaveToPhotos={onSaveToPhotos}
            onDelete={onDeletePhoto}
          />
        </View>
        <Text style={s.hint}>Up to {MAX_PART_PHOTOS} reference photos.</Text>

        {fromPicker && <Text style={[s.hint, { marginTop: 16 }]}>This part will be added to the filter you came from.</Text>}
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
  });
}