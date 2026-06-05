// app/filter/edit/[id].js — Edit Filter.
//
// A filter is the set of PARTS it contains. The PARTS section opens a
// multi-select picker (/picker?kind=part&multi=1); each checked part becomes a
// tracked line (a stage). The replacement interval lives on the PART (edited on
// the Part screen) and is shown read-only beside each one — there is no
// filter-level interval. A filter with NO parts simply has no schedule; to
// track something by hand, use the Notes field.
//
// Each existing part keeps its stage id + lastReplaced (history preserved);
// newly-attached parts start fresh (the store stamps lastReplaced on save).
// Removing every part saves an empty stages array (no schedule).
//
// Asset is selected via the single-select /picker route. Picks come back via
// lib/pendingPick on focus:
//   asset -> { field:'asset', value }
//   parts -> { field:'parts', values:[...] }  (the multi picker's Done)
//
// Notes + Delete sit at the bottom (iOS Notes/Reminders pattern).
//
// Keyboard handling: KeyboardAwareScrollView. Requires <KeyboardProvider> in
// app/_layout.js. Native module — needs a dev rebuild to take effect.

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../theme/theme';
import { PillButton } from '../../../components/HeaderBits';
import { loadData, saveData, updateFilter, deleteFilter, FILTER_TYPES, partsList, filterStages, DEFAULT_INTERVAL_DAYS } from '../../../data/store';
import { formatInterval } from '../../../lib/interval';
import { consumePendingPick } from '../../../lib/pendingPick';

let _sid = 0;
const newStageId = () => 'st_' + Date.now().toString(36) + '_' + (_sid++);

export default function EditFilter() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => {
      if (!active) return;
      setData(d);
      if (!draft || !Array.isArray(draft.partIds)) {
        const f = d.filters.find(x => x.id === id);
        if (f) {
          const stages = filterStages(f);
          const preserved = {};
          const partIds = [];
          stages.forEach(st => {
            if (st.partId && !preserved[st.partId]) {
              preserved[st.partId] = { id: st.id, lastReplaced: st.lastReplaced };
              partIds.push(st.partId);
            }
          });
          setDraft({
            name: f.name,
            type: f.type,
            assetId: f.assetId,
            notes: f.notes || '',
            partIds,
            preserved,
          });
        }
      } else {
        const pick = consumePendingPick();
        if (pick) {
          setDraft(prev => {
            if (pick.field === 'asset') return { ...prev, assetId: pick.value };
            if (pick.field === 'parts') return { ...prev, partIds: pick.values || [] };
            return prev;
          });
        }
      }
    });
    return () => { active = false; };
  }, [id, draft]));

  const s = makeStyles(t);
  if (!data || !draft) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const assets = data.assets.filter(a => !a.archived);
  const parts = partsList(data);
  const currentAsset = assets.find(a => a.id === draft.assetId);
  const partIds = draft.partIds || [];
  const selectedParts = partIds
    .map(pid => parts.find(p => p.id === pid))
    .filter(Boolean);

  const openAssetPicker = () =>
    router.push({ pathname: '/picker', params: { kind: 'asset', selectedId: draft.assetId || '', filterId: id } });

  const openPartsPicker = () =>
    router.push({ pathname: '/picker', params: { kind: 'part', multi: '1', selectedIds: partIds.join(',') } });

  const save = async () => {
    // Parts are the only schedule source. No parts -> no stages -> no schedule.
    const stages = partIds.map(pid => {
      const prev = draft.preserved[pid];
      const part = parts.find(p => p.id === pid);
      return {
        id: (prev && prev.id) || newStageId(),
        partId: pid,
        // Stage fallback = the part's interval (resolution prefers the part).
        intervalDays: (part && typeof part.intervalDays === 'number') ? part.intervalDays : DEFAULT_INTERVAL_DAYS,
        ...((prev && prev.lastReplaced) ? { lastReplaced: prev.lastReplaced } : null),
      };
    });
    const patch = {
      name: draft.name.trim() || draft.name,
      type: draft.type,
      assetId: draft.assetId,
      notes: (draft.notes || '').trim(),
      stages,
    };
    const next = updateFilter(data, id, patch);
    await saveData(next);
    router.back();
  };

  const askDelete = () => {
    Alert.alert(
      'Delete filter?',
      `This will remove "${draft.name}" and its replacement history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const next = deleteFilter(data, id);
            await saveData(next);
            router.back();
            setTimeout(() => router.back(), 0);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
        <PillButton label="Save" onPress={save} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>Edit Filter</Text>
        <Text style={s.sub}>Change the parts, type, location, or notes.</Text>

        <Text style={s.label}>TYPE</Text>
        <View style={s.typeRow}>
          {Object.entries(FILTER_TYPES).map(([k, v]) => {
            const on = draft.type === k;
            return (
              <Pressable key={k} onPress={() => setDraft({ ...draft, type: k })} style={[s.typeChip, on && s.typeChipOn]}>
                <Text style={[s.typeLabel, on && s.typeLabelOn]}>{v.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.label}>NAME</Text>
        <TextInput
          style={s.input}
          value={draft.name}
          onChangeText={(v) => setDraft({ ...draft, name: v })}
          placeholderTextColor={t.muted}
        />

        <Text style={s.label}>ASSET</Text>
        <Pressable style={s.pickerRow} onPress={openAssetPicker}>
          <Text style={[s.pickerValue, !currentAsset && s.pickerPlaceholder]} numberOfLines={1}>
            {currentAsset ? currentAsset.name : 'Choose asset'}
          </Text>
          <Text style={s.chev}>›</Text>
        </Pressable>

        <Text style={s.label}>PARTS</Text>
        <Pressable style={s.pickerRow} onPress={openPartsPicker}>
          <Text style={[s.pickerValue, selectedParts.length === 0 && s.pickerPlaceholder]} numberOfLines={1}>
            {selectedParts.length === 0
              ? 'Attach parts'
              : (selectedParts.length === 1 ? '1 part attached' : `${selectedParts.length} parts attached`)}
          </Text>
          <Text style={s.chev}>›</Text>
        </Pressable>

        {selectedParts.length > 0 && (
          <View style={s.partsBox}>
            {selectedParts.map((p, i) => (
              <View key={p.id} style={[s.partRow, i > 0 && s.partRowDivider]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.partName} numberOfLines={1}>{p.name || 'Untitled part'}</Text>
                  <Text style={s.partSub} numberOfLines={1}>
                    Every {formatInterval(p.intervalDays != null ? p.intervalDays : DEFAULT_INTERVAL_DAYS)}
                    {p.sku ? `  ·  ${p.sku}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={s.hint}>
          Attach a part to track stock, reorders, and replacement intervals. To
          track this filter by hand instead, use the Notes field below.
        </Text>

        <Text style={s.label}>NOTES</Text>
        <TextInput
          style={s.notesInput}
          value={draft.notes}
          onChangeText={(v) => setDraft({ ...draft, notes: v })}
          placeholder="Procurement details, install notes, model numbers…"
          placeholderTextColor={t.muted}
          multiline
          textAlignVertical="top"
        />

        <Pressable style={s.delBtn} onPress={askDelete}>
          <Text style={s.delTxt}>Delete Filter</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 22, paddingBottom: 6,
    },
    cancel: { color: t.inkSoft, fontSize: 15 },
    title: { ...t.type.title, fontSize: 26, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16 },
    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 13 },
    input: { padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },
    notesInput: {
      padding: 13, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16,
      minHeight: 110, textAlignVertical: 'top',
    },
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: t.radius.chip, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    typeChipOn: { backgroundColor: t.tabIdleBg },
    typeLabel: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    typeLabelOn: { color: t.ink, fontWeight: '700' },
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 13, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card,
    },
    pickerValue: { fontSize: 16, color: t.ink, flex: 1, marginRight: 8 },
    pickerPlaceholder: { color: t.muted },
    chev: { fontSize: 22, color: t.muted },

    // Selected-parts list (each part = a tracked line / stage).
    partsBox: { marginTop: 10, backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.line, paddingHorizontal: 14 },
    partRow: { paddingVertical: 12 },
    partRowDivider: { borderTopWidth: 1, borderTopColor: t.line },
    partName: { fontSize: 15, fontWeight: '700', color: t.ink },
    partSub: { fontSize: 12.5, color: t.muted, marginTop: 3 },

    hint: { fontSize: 12, color: t.muted, marginTop: 10, paddingLeft: 13 },

    delBtn: { marginTop: 28, padding: 12, alignItems: 'center' },
    delTxt: { color: '#dc2626', fontSize: 14 },
  });
}