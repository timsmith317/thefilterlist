// app/part/[id].js — Part Detail.
//
// View and Edit modes now share the SAME title metrics and the SAME spacing
// down to ON HAND, so toggling edit/save doesn't shift the page.
//   - title and titleInput both fontSize 26, same marginTop, no underline
//   - the low-stock slot renders in BOTH modes (empty in edit) so the gap to
//     ON HAND is identical
//   - slot height tightened so it's not too tall when the badge is absent
//
// Threshold text reads "Alert when N or less".

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton, PillButton } from '../../components/HeaderBits';
import PhotoStrip from '../../components/PhotoStrip';
import { loadData, saveData, updatePart, deletePart, filtersUsingPart, isPartLow, addPartPhoto, removePartPhoto, MAX_PART_PHOTOS } from '../../data/store';
import { pickFromLibrary, takePhoto, saveToPhotos, deleteFile } from '../../lib/partPhotos';

export default function PartDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const s = makeStyles(t);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => {
      if (active) {
        setData(d);
        const p = d.parts.find(x => x.id === id);
        if (p) setDraft({ ...p });
      }
    });
    return () => { active = false; };
  }, [id]));

  if (!data || !draft) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const part = data.parts.find(x => x.id === id);
  if (!part) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.head}><BackButton onPress={() => router.back()} /><View /></View>
        <Text style={{ color: t.ink, padding: 22 }}>Part not found.</Text>
      </SafeAreaView>
    );
  }

  const filters = filtersUsingPart(data, part.id);
  const low = isPartLow(part);

  const save = async () => {
    const clean = {
      ...draft,
      onHand: Math.max(0, parseInt(draft.onHand, 10) || 0),
      lowStockThreshold: Math.max(0, parseInt(draft.lowStockThreshold, 10) || 0),
    };
    const next = updatePart(data, part.id, clean);
    setData(next);
    setDraft({ ...clean });
    await saveData(next);
    setEditing(false);
  };

  const bump = async (delta) => {
    const newOn = Math.max(0, (part.onHand || 0) + delta);
    const next = updatePart(data, part.id, { onHand: newOn });
    setData(next);
    setDraft({ ...draft, onHand: newOn });
    await saveData(next);
  };

  const openLink = () => { if (part.reorderUrl) Linking.openURL(part.reorderUrl); };

  const askDelete = () => {
    Alert.alert(
      'Delete part?',
      filters.length
        ? `This part is used by ${filters.length} filter${filters.length > 1 ? 's' : ''}. They will keep their settings but lose the part link.`
        : 'This will remove the part. No filters reference it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          for (const u of (part.photos || [])) await deleteFile(u);
          const n = deletePart(data, part.id); await saveData(n); router.back();
        } },
      ]
    );
  };

  const onPickPhoto = async (source) => {
    if ((part.photos || []).length >= MAX_PART_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_PART_PHOTOS} photos per part.`);
      return;
    }
    const uri = source === 'camera' ? await takePhoto() : await pickFromLibrary();
    if (!uri) return;
    const next = addPartPhoto(data, part.id, uri);
    setData(next);
    await saveData(next);
  };

  const onSaveToPhotos = async (uri) => {
    const ok = await saveToPhotos(uri);
    if (ok) Alert.alert('Saved', 'Photo saved to your library.');
  };

  const onDeletePhoto = async (index) => {
    const uri = (part.photos || [])[index];
    const next = removePartPhoto(data, part.id, index);
    setData(next);
    await saveData(next);
    await deleteFile(uri);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        {editing ? (
          <PillButton label="Save" onPress={save} />
        ) : (
          <PillButton label="Edit" onPress={() => setEditing(true)} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        {editing ? (
          <TextInput value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} placeholder="Name" placeholderTextColor={t.muted} style={s.titleInput} />
        ) : (
          <Text style={s.title}>{part.name || 'Untitled part'}</Text>
        )}

        {/* Low-stock slot renders in BOTH modes (empty in edit) so the gap to
            ON HAND is identical and the page doesn't shift on save. Height
            tightened to just fit the badge. */}
        <View style={s.lowSlot}>
          {!editing && low && (
            <View style={s.lowPill}><Text style={s.lowPillTxt}>Low Stock</Text></View>
          )}
        </View>

        <Text style={[s.label, s.firstLabel]}>ON HAND</Text>
        <View style={s.stepperRow}>
          <Pressable style={s.stepBtn} onPress={() => bump(-1)} hitSlop={6}><Text style={s.stepTxt}>−</Text></Pressable>
          <Text style={s.stepCount}>{part.onHand}</Text>
          <Pressable style={s.stepBtn} onPress={() => bump(1)} hitSlop={6}><Text style={s.stepTxt}>+</Text></Pressable>
        </View>

        <Text style={s.label}>LOW-STOCK THRESHOLD</Text>
        {editing ? (
          <TextInput
            value={String(draft.lowStockThreshold)}
            onChangeText={(v) => setDraft({ ...draft, lowStockThreshold: v.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            style={s.input}
          />
        ) : (
          <Text style={s.value}>Alert when {part.lowStockThreshold} or less</Text>
        )}

        <Text style={s.label}>SKU</Text>
        {editing ? (
          <TextInput value={draft.sku} onChangeText={(v) => setDraft({ ...draft, sku: v })} placeholder="e.g. EDR1RXD1" placeholderTextColor={t.muted} style={s.input} autoCapitalize="characters" />
        ) : (
          <Text style={s.value}>{part.sku || '—'}</Text>
        )}

        <Text style={s.label}>REORDER URL</Text>
        {editing ? (
          <TextInput value={draft.reorderUrl} onChangeText={(v) => setDraft({ ...draft, reorderUrl: v })} placeholder="https://..." placeholderTextColor={t.muted} style={s.input} autoCapitalize="none" autoCorrect={false} />
        ) : part.reorderUrl ? (
          <Pressable onPress={openLink} style={s.openLink}>
            <Text style={s.openLinkTxt} numberOfLines={1}>{part.reorderUrl}</Text>
            <Text style={s.openLinkArrow}>↗</Text>
          </Pressable>
        ) : (
          <Text style={s.value}>—</Text>
        )}

        <Text style={s.label}>PHOTOS</Text>
        <View style={{ paddingLeft: 16 }}>
          <PhotoStrip
            photos={part.photos || []}
            max={MAX_PART_PHOTOS}
            onPick={(source) => onPickPhoto(source)}
            onSaveToPhotos={onSaveToPhotos}
            onDelete={onDeletePhoto}
          />
        </View>
        <Text style={s.hint}>Up to {MAX_PART_PHOTOS} reference photos.</Text>

        {!editing && filters.length > 0 && (
          <>
            <Text style={s.label}>USED BY ({filters.length})</Text>
            <View style={s.usedBox}>
              {filters.map(f => (
                <Pressable key={f.id} style={s.usedRow} onPress={() => router.push(`/filter/${f.id}`)}>
                  <Text style={s.usedTxt}>{f.name}</Text>
                  <Text style={s.chev}>›</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {!editing && (
          <Pressable style={s.delBtn} onPress={askDelete}>
            <Text style={s.delTxt}>Delete Part</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },

    // View and edit titles share the SAME font size (26), weight, top margin,
    // and indent, so toggling modes doesn't shift the page. No underline.
    title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5, color: t.ink, marginTop: 0, paddingLeft: 16 },
    titleInput: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5, color: t.ink, marginTop: 0, paddingLeft: 16, paddingVertical: 0 },

    // Tightened low-stock slot: small consistent gap above ON HAND in both
    // modes. Reduced from height 22/marginTop 6 to shrink the empty space.
    lowSlot: { height: 22, marginTop: 2, paddingLeft: 16, justifyContent: 'center' },

    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 16 },
    // First section (ON HAND) sits closer to the title/badge above it.
    firstLabel: { marginTop: 8 },
    value: { fontSize: 15, fontWeight: '600', color: t.ink, paddingLeft: 16 },
    input: { padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },

    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 16 },
    stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: t.tabIdleBg, alignItems: 'center', justifyContent: 'center' },
    stepTxt: { fontSize: 24, fontWeight: '700', color: t.ink },
    stepCount: { fontSize: 22, fontWeight: '800', color: t.ink, minWidth: 40, textAlign: 'center' },

    openLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 10, backgroundColor: t.tabIdleBg },
    openLinkTxt: { color: t.ink, fontSize: 14, flex: 1, marginRight: 8 },
    openLinkArrow: { color: t.inkSoft, fontSize: 18, fontWeight: '700' },

    lowPill: { alignSelf: 'flex-start', backgroundColor: t.status.amb.pillBg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    lowPillTxt: { color: t.status.amb.pillInk, fontSize: 11.5, fontWeight: '700', textAlign: 'center' },

    hint: { fontSize: 12, color: t.muted, marginTop: 8, paddingLeft: 16 },

    usedBox: { backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, paddingHorizontal: 14 },
    usedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line },
    usedTxt: { fontSize: 14, color: t.ink, fontWeight: '600' },
    chev: { fontSize: 22, color: t.muted },

    delBtn: { marginTop: 28, padding: 12, alignItems: 'center' },
    delTxt: { color: '#dc2626', fontSize: 14 },
  });
}
