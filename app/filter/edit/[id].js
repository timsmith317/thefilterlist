// app/filter/edit/[id].js — Edit Filter.
//
// Asset and Part are selected via the /picker modal route (handles many items
// with search). The picker is a stacked screen rather than an overlay so that
// "+ Add new part" can push New Part ON TOP of the picker — New Part covers it
// and nothing rolls away.
//
// Selection round-trip:
//   - Tapping ASSET or PART pushes /picker with the current selection. The
//     picker stashes the chosen id in lib/pendingPick and pops; we read it
//     here on focus and fold it into the draft.
//   - "+ Add new part" (inside the picker) routes to /part/new with filterId.
//     New Part links the part, stashes it in pendingPick, and pops BOTH itself
//     and the picker, landing back here with the new part selected.
//
// Notes: a multiline NOTES field sits at the bottom, just above Delete Filter.
// It's where filter notes are authored; the detail screen shows them read-only
// (with a Copy button) when present.
//
// Delete Filter lives at the bottom of THIS screen (the edit screen), not the
// detail screen — same pattern iOS Notes/Reminders use. Burying the
// destructive action under "Edit" makes it discoverable without making it a
// one-tap-away mistake from the view screen.
//
// Keyboard handling: KeyboardAwareScrollView (react-native-keyboard-controller)
// scrolls the focused input clear of the keyboard. Requires <KeyboardProvider>
// in app/_layout.js. Native module — needs a dev rebuild to take effect.

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../theme/theme';
import { PillButton } from '../../../components/HeaderBits';
import { loadData, saveData, updateFilter, deleteFilter, FILTER_TYPES, partsList } from '../../../data/store';
import { consumePendingPick } from '../../../lib/pendingPick';

export default function EditFilter() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);

  // Reload data on focus. On initial focus, initialize the draft. On
  // subsequent focus (returning from the picker or the + Add new part flow),
  // refresh data AND consume any pending selection handed back by the picker.
  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => {
      if (!active) return;
      setData(d);
      if (!draft) {
        const f = d.filters.find(x => x.id === id);
        if (f) setDraft({ ...f, interval: String(f.intervalDays), notes: f.notes || '' });
      } else {
        const pick = consumePendingPick();
        if (pick) {
          setDraft(prev => ({
            ...prev,
            ...(pick.field === 'asset' ? { assetId: pick.value } : null),
            ...(pick.field === 'part' ? { partId: pick.value } : null),
          }));
        }
      }
    });
    return () => { active = false; };
  }, [id, draft]));

  const s = makeStyles(t);
  if (!data || !draft) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const assets = data.assets.filter(a => !a.archived);
  const parts = partsList(data); // already sorted by name in store

  const currentAsset = assets.find(a => a.id === draft.assetId);
  const currentPart = parts.find(p => p.id === draft.partId);

  const openAssetPicker = () =>
    router.push({ pathname: '/picker', params: { kind: 'asset', selectedId: draft.assetId || '', filterId: id } });

  const openPartPicker = () =>
    router.push({ pathname: '/picker', params: { kind: 'part', selectedId: draft.partId || '', filterId: id } });

  const save = async () => {
    const patch = {
      name: draft.name.trim() || draft.name,
      type: draft.type,
      intervalDays: Math.max(1, parseInt(draft.interval, 10) || 90),
      assetId: draft.assetId,
      partId: draft.partId || null,
      notes: (draft.notes || '').trim(),
    };
    const next = updateFilter(data, id, patch);
    await saveData(next);
    router.back();
  };

  // Delete with destructive confirmation. After delete we router.back()
  // TWICE: once out of the edit screen, once out of the now-empty detail
  // screen — landing the user back on Due Soon (or wherever they came from
  // before the detail screen).
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
        <Text style={s.sub}>Change schedule, type, location, or linked part.</Text>

        <Text style={s.label}>TYPE</Text>
        <View style={s.typeRow}>
          {Object.entries(FILTER_TYPES).map(([k, v]) => {
            const on = draft.type === k;
            return (
              <Pressable
                key={k}
                onPress={() => setDraft({ ...draft, type: k })}
                style={[s.typeChip, on && s.typeChipOn]}
              >
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

        <Text style={s.label}>INTERVAL (days)</Text>
        <TextInput
          style={s.input}
          value={draft.interval}
          onChangeText={(v) => setDraft({ ...draft, interval: v.replace(/[^0-9]/g, '') })}
          keyboardType="number-pad"
        />

        <Text style={s.label}>ASSET</Text>
        <Pressable style={s.pickerRow} onPress={openAssetPicker}>
          <Text style={[s.pickerValue, !currentAsset && s.pickerPlaceholder]} numberOfLines={1}>
            {currentAsset ? currentAsset.name : 'Choose asset'}
          </Text>
          <Text style={s.chev}>›</Text>
        </Pressable>

        <Text style={s.label}>PART</Text>
        <Pressable style={s.pickerRow} onPress={openPartPicker}>
          <Text style={[s.pickerValue, !currentPart && s.pickerPlaceholder]} numberOfLines={1}>
            {currentPart ? currentPart.name : 'None'}
          </Text>
          <Text style={s.chev}>›</Text>
        </Pressable>
        <Text style={s.hint}>Link a part to track stock and reorder info.</Text>

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

        {/* Destructive action lives at the bottom of the Edit screen.
            iOS Notes / Reminders / Contacts use this same pattern — burying
            delete under Edit makes it discoverable without being a one-tap
            mistake from view mode. */}
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
    label: {
      ...t.type.kicker, color: t.muted, textTransform: 'uppercase',
      marginTop: 22, marginBottom: 8, paddingLeft: 13,
    },
    input: {
      padding: 13, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16,
    },

    // Multiline notes — same visual weight as input, taller, top-aligned text.
    notesInput: {
      padding: 13, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16,
      minHeight: 110, textAlignVertical: 'top',
    },

    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: {
      flex: 1, alignItems: 'center', paddingVertical: 14,
      borderRadius: t.radius.chip, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card,
    },
    typeChipOn: { backgroundColor: t.tabIdleBg },
    typeLabel: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    typeLabelOn: { color: t.ink, fontWeight: '700' },

    // Picker rows — same visual weight as inputs so the form feels uniform.
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 13, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card,
    },
    pickerValue: { fontSize: 16, color: t.ink, flex: 1, marginRight: 8 },
    pickerPlaceholder: { color: t.muted },
    chev: { fontSize: 22, color: t.muted },

    hint: { fontSize: 12, color: t.muted, marginTop: 10, paddingLeft: 13 },

    // Destructive action at the bottom of the form.
    delBtn: { marginTop: 28, padding: 12, alignItems: 'center' },
    delTxt: { color: '#dc2626', fontSize: 14 },
  });
}