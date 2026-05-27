// app/part/[id].js — Part Detail: view & edit a shared part.
// Shared across filters: shows which filters use this part. On-hand +/-, low
// stock threshold, reorder URL with open button, SKU, name.

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { IconBack } from '../../theme/Icons';
import { loadData, saveData, updatePart, deletePart, filtersUsingPart, isPartLow } from '../../data/store';

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
    loadData().then(d => { if (active) { setData(d); const p = d.parts.find(x => x.id === id); if (p) setDraft({ ...p }); } });
    return () => { active = false; };
  }, [id]));

  if (!data || !draft) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const part = data.parts.find(x => x.id === id);
  if (!part) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10}>
          <IconBack size={26} color={t.ink} /><Text style={s.backTxt}>Back</Text>
        </Pressable>
        <Text style={{ color: t.ink, padding: 22 }}>Part not found.</Text>
      </SafeAreaView>
    );
  }

  const filters = filtersUsingPart(data, part.id);
  const low = isPartLow(part);

  const save = async () => {
    // Clamp numeric fields
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
        { text: 'Delete', style: 'destructive', onPress: async () => { const n = deletePart(data, part.id); await saveData(n); router.back(); } },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10}>
          <IconBack size={26} color={t.ink} /><Text style={s.backTxt}>Back</Text>
        </Pressable>
        {editing ? (
          <Pressable onPress={save} hitSlop={10}><Text style={s.editTxt}>Save</Text></Pressable>
        ) : (
          <Pressable onPress={() => setEditing(true)} hitSlop={10}><Text style={s.editTxt}>Edit</Text></Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
        <Text style={s.kicker}>PART</Text>
        {editing ? (
          <TextInput value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} placeholder="Name" placeholderTextColor={t.muted} style={s.titleInput} />
        ) : (
          <Text style={s.title}>{part.name || 'Untitled part'}</Text>
        )}

        {low && !editing && (
          <View style={[s.lowPill, { alignSelf: 'flex-start', marginTop: 8 }]}><Text style={s.lowPillTxt}>Low stock</Text></View>
        )}

        <Text style={s.label}>ON HAND</Text>
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
          <Text style={s.value}>Alert when on-hand ≤ {part.lowStockThreshold}</Text>
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
            <Text style={s.delTxt}>Delete part</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 6 },
    backTxt: { color: t.ink, fontSize: 16, fontWeight: '600' },
    editTxt: { color: t.ink, fontSize: 15, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 6 },

    kicker: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 8 },
    title: { ...t.type.title, fontSize: 26, color: t.ink, marginTop: 4 },
    titleInput: { fontSize: 24, fontWeight: '800', color: t.ink, marginTop: 4, borderBottomWidth: 1, borderBottomColor: t.line, paddingVertical: 6 },

    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
    value: { fontSize: 15, fontWeight: '600', color: t.ink },
    input: { padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },

    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: t.tabIdleBg, alignItems: 'center', justifyContent: 'center' },
    stepTxt: { fontSize: 24, fontWeight: '700', color: t.ink },
    stepCount: { fontSize: 22, fontWeight: '800', color: t.ink, minWidth: 40, textAlign: 'center' },

    openLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 10, backgroundColor: t.tabIdleBg },
    openLinkTxt: { color: t.ink, fontSize: 14, flex: 1, marginRight: 8 },
    openLinkArrow: { color: t.inkSoft, fontSize: 18, fontWeight: '700' },

    lowPill: { backgroundColor: t.status.amb.pillBg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
    lowPillTxt: { color: t.status.amb.pillInk, fontSize: 11.5, fontWeight: '700' },

    usedBox: { backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.line, paddingHorizontal: 14 },
    usedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.line },
    usedTxt: { fontSize: 14, color: t.ink, fontWeight: '600' },
    chev: { fontSize: 22, color: t.muted },

    delBtn: { marginTop: 28, padding: 12, alignItems: 'center' },
    delTxt: { color: '#dc2626', fontSize: 14 },
  });
}
