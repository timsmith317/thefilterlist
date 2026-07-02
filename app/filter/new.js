// app/filter/new.js — New Filter.
// Modal page padding (clears iOS modal chrome edge). Title indented 16 to
// match Settings. Field labels indented 13 to align with input text inside
// each input box.
//
// Two ways in:
//   - From the Filters inventory ("+ Add filter"): no stageId. Save/Cancel just
//     pop back to the inventory.
//   - From the Choose Filter picker on New/Edit Device ("+ Add new filter"): a
//     stageId is set. New Filter is stacked ON TOP of the picker. On Save we
//     create the filter, hand its id (plus the stageId) back to the opener via
//     pendingPick, and pop BOTH this screen and the picker (dismiss(2)) so we
//     land straight back on the form with the new filter selected for that
//     stage. We do NOT write the link onto a saved device here — linking is
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
import PhotoCropper from '../../components/PhotoCropper';
import CameraCaptureModal from '../../components/CameraCaptureModal';
import IntervalField from '../../components/IntervalField';
import { loadData, saveData, addFilter, FILTER_TYPES, MAX_FILTER_PHOTOS } from '../../data/store';
import { intervalToDays } from '../../lib/interval';
import { pickFromLibrary, saveToPhotos, deleteFile } from '../../lib/filterPhotos';
import { setPendingPick } from '../../lib/pendingPick';

export default function NewFilter() {
  const t = useTheme();
  const router = useRouter();
  const { stageId, multi } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('water');
  const [intervalValue, setIntervalValue] = useState('90');
  const [intervalUnit, setIntervalUnit] = useState('days');
  const [sku, setSku] = useState('');
  const [reorderUrl, setReorderUrl] = useState('');
  const [onHand, setOnHand] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('1');
  const [photos, setPhotos] = useState([]);
  const [cropAsset, setCropAsset] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => { loadData().then(setData); }, []);
  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  // How we got here: the Device editor's multi-select Filters picker (multi),
  // a single stage's filter picker (stageId), or the Filters inventory (neither).
  const fromMultiPicker = multi === '1' || multi === 'true';
  const fromStagePicker = !!stageId;
  const fromPicker = fromMultiPicker || fromStagePicker;

  const onCancel = async () => {
    for (const u of photos) await deleteFile(u);
    router.back();
  };

  const save = async () => {
    const next = addFilter(data, {
      name: name.trim() || 'Untitled filter',
      type,
      intervalDays: intervalToDays(intervalValue, intervalUnit),
      sku: sku.trim(),
      reorderUrl: reorderUrl.trim(),
      photos,
      onHand: Math.max(0, parseInt(onHand, 10) || 0),
      lowStockThreshold: Math.max(0, parseInt(lowStockThreshold, 10) || 0),
    });
    const newFilter = next.filters[next.filters.length - 1];
    await saveData(next);

    if (fromMultiPicker) {
      // Stack: Device editor → multi Filters picker → here. Pop back to the
      // picker (one level) and hand it the new id; the picker folds it into
      // its live selection so it lands pre-checked, then Done returns the set.
      setPendingPick({ field: 'addFilter', value: newFilter.id });
      router.back();
    } else if (fromStagePicker) {
      // Stack: form → single stage picker → here. Hand the new filter (and which
      // stage it's for) back to the form, then pop this screen AND the picker
      // so we land straight on the form with the filter selected for that stage.
      setPendingPick({ field: 'filter', value: newFilter.id, stageId });
      router.dismiss(2);
    } else {
      router.back();
    }
  };

  const onPickPhoto = async (source) => {
    if (photos.length >= MAX_FILTER_PHOTOS) {
      Alert.alert('Limit reached', `Up to ${MAX_FILTER_PHOTOS} photos.`);
      return;
    }
    if (source === 'camera') { setCameraOpen(true); return; }
    const asset = await pickFromLibrary();
    if (!asset) return;
    setCropAsset(asset);
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
        contentContainerStyle={{ paddingHorizontal: t.isTablet ? t.ui(32) : 18, paddingBottom: 40 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>New Filter</Text>
        <Text style={s.sub}>Track stock and reorder info for this filter.</Text>

        <Text style={s.label}>TYPE</Text>
        <View style={s.typeRow}>
          {Object.entries(FILTER_TYPES).map(([k, v]) => {
            const on = type === k;
            return (
              <Pressable key={k} onPress={() => setType(k)} style={[s.typeChip, on && s.typeChipOn]}>
                <Text style={[s.typeChipTxt, on && s.typeChipTxtOn]}>{v.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>NAME</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. 20x25x1 MERV 11" placeholderTextColor={t.muted} />

        <Text style={s.label}>REPLACE EVERY</Text>
        <IntervalField
          value={intervalValue}
          unit={intervalUnit}
          onChangeValue={setIntervalValue}
          onChangeUnit={setIntervalUnit}
        />

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
        <View>
          <PhotoStrip
            photos={photos}
            max={MAX_FILTER_PHOTOS}
            onPick={onPickPhoto}
            onSaveToPhotos={onSaveToPhotos}
            onDelete={onDeletePhoto}
          />
        </View>
        <Text style={s.hint}>Up to {MAX_FILTER_PHOTOS} reference photos.</Text>

        {fromPicker && <Text style={[s.hint, { marginTop: 16 }]}>This filter will be added to the device you came from.</Text>}
      </KeyboardAwareScrollView>

      <PhotoCropper
        visible={!!cropAsset}
        asset={cropAsset}
        onCancel={() => setCropAsset(null)}
        onDone={(uri) => {
          if (uri) setPhotos(prev => [...prev, uri].slice(0, MAX_FILTER_PHOTOS));
          setCropAsset(null);
        }}
      />

      <CameraCaptureModal
        visible={cameraOpen}
        onCancel={() => setCameraOpen(false)}
        onCapture={(asset) => { setCameraOpen(false); setCropAsset(asset); }}
      />
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: t.isTablet ? t.ui(32) : 18, paddingTop: 22, paddingBottom: 6 },
    cancel: { color: t.inkSoft, fontSize: t.uit(15), paddingLeft: 16 },
    title: { ...t.type.title, fontSize: t.uit(26), color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: t.uit(13), color: t.muted, marginTop: 4, paddingLeft: 16 },
    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 13 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: { paddingHorizontal: t.ui(16), paddingVertical: t.ui(8), borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    typeChipOn: { backgroundColor: t.tabIdleBg },
    typeChipTxt: { fontSize: t.uit(13), fontWeight: '600', color: t.inkSoft },
    typeChipTxtOn: { color: t.ink },
    input: { padding: t.ui(13), borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: t.uit(16) },
    hint: { fontSize: t.uit(12), color: t.muted, marginTop: 8, paddingLeft: 13 },
  });
}