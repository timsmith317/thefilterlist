// app/part/new.js — New Part.
// Modal page padding (clears iOS modal chrome edge). Title indented 16 to
// match Settings. Field labels indented 13 to align with input text inside
// each input box (input has padding: 13 so its text starts at x=page+13).

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { PillButton } from '../../components/HeaderBits';
import PhotoStrip from '../../components/PhotoStrip';
import { loadData, saveData, addPart, updateFilter, MAX_PART_PHOTOS } from '../../data/store';
import { pickFromLibrary, takePhoto, saveToPhotos, deleteFile } from '../../lib/partPhotos';

export default function NewPart() {
  const t = useTheme();
  const router = useRouter();
  const { filterId } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [reorderUrl, setReorderUrl] = useState('');
  const [onHand, setOnHand] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('1');
  const [photos, setPhotos] = useState([]);

  useEffect(() => { loadData().then(setData); }, []);
  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const onCancel = async () => {
    for (const u of photos) await deleteFile(u);
    router.back();
  };

  const save = async () => {
    let next = addPart(data, {
      name: name.trim() || 'Untitled part',
      sku: sku.trim(),
      reorderUrl: reorderUrl.trim(),
      photos,
      onHand: Math.max(0, parseInt(onHand, 10) || 0),
      lowStockThreshold: Math.max(0, parseInt(lowStockThreshold, 10) || 0),
    });
    const newPart = next.parts[next.parts.length - 1];
    if (filterId) next = updateFilter(next, filterId, { partId: newPart.id });
    await saveData(next);
    router.back();
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

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        <Text style={s.title}>New Part</Text>
        <Text style={s.sub}>Track stock and reorder info for this filter.</Text>

        <Text style={s.label}>NAME</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. 20x25x1 MERV 11" placeholderTextColor={t.muted} />

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
        {/* Photo strip wrapped so its left edge aligns with input text */}
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

        {!!filterId && <Text style={[s.hint, { marginTop: 16 }]}>This part will be linked to the filter you came from.</Text>}
      </ScrollView>
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
    // Labels indented to align with text inside the input field (input has padding: 13)
    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 13 },
    input: { padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },
    hint: { fontSize: 12, color: t.muted, marginTop: 8, paddingLeft: 13 },
  });
}
