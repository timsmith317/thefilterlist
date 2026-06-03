// app/filter/edit/[id].js — Edit Filter.
//
// Asset and Part are now selected via the PickerSheet modal (handles many
// items with search), replacing the chip wrap that didn't scale.
//
// Part picker supports:
//   - "None (no part linked)" row
//   - "+ Add new part" row → routes to /part/new with filterId so the new
//     part links automatically; setPendingPart() carries the new id back
//     so Edit Filter can auto-select it on return.
//
// Notes: a multiline NOTES field sits at the bottom, just above Delete Filter.
// It's where filter notes are authored; the detail screen shows them read-only
// (with a Copy button) when present.
//
// Delete Filter lives at the bottom of THIS screen (the edit screen), not
// the detail screen — same pattern iOS Notes/Reminders use. Burying the
// destructive action under "Edit" makes it discoverable without making it
// a one-tap-away mistake from the view screen.
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
import PickerSheet from '../../../components/PickerSheet';
import { loadData, saveData, updateFilter, deleteFilter, FILTER_TYPES, partsList } from '../../../data/store';
import { consumePendingPart } from '../../../lib/pendingPart';

export default function EditFilter() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [partPickerOpen, setPartPickerOpen] = useState(false);

  // Reload data on focus. On initial focus, initialize the draft. On
  // subsequent focus (e.g., returning from the + Add new part flow),
  // refresh the parts list AND consume any pending part selection.
  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => {
      if (!active) return;
      setData(d);
      if (!draft) {
        const f = d.filters.find(x => x.id === id);
        if (f) setDraft({ ...f, interval: String(f.intervalDays), notes: f.notes || '' });
      } else {
        const pending = consumePendingPart();
        if (pending) setDraft(prev => ({ ...prev, partId: pending }));
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
  // screen — landing the user back on Due Soon (or wherever they came
  // from before the detail screen).
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
            // Back out of edit → detail. The detail screen will redirect
            // away on its own next render since the filter no longer
            // exists, OR pop again explicitly:
            router.back();
            // Slight delay so the first back() commits before the second.
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
        <Pressable style={s.pickerRow} onPress={() => setAssetPickerOpen(true)}>
          <Text style={[s.pickerValue, !currentAsset && s.pickerPlaceholder]} numberOfLines={1}>
            {currentAsset ? currentAsset.name : 'Choose asset'}
          </Text>
          <Text style={s.chev}>›</Text>
        </Pressable>

        <Text style={s.label}>PART</Text>
        <Pressable style={s.pickerRow} onPress={() => setPartPickerOpen(true)}>
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
        <Text style={s.hint}>Shown on the filter's detail screen with a copy button.</Text>

        {/* Destructive action lives at the bottom of the Edit screen.
            iOS Notes / Reminders / Contacts use this same pattern — burying
            delete under Edit makes it discoverable without being a one-tap
            mistake from view mode. */}
        <Pressable style={s.delBtn} onPress={askDelete}>
          <Text style={s.delTxt}>Delete Filter</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <PickerSheet
        visible={assetPickerOpen}
        title="Choose Asset"
        items={assets}
        selectedId={draft.assetId}
        onSelect={(aid) => {
          setDraft({ ...draft, assetId: aid });
          setAssetPickerOpen(false);
        }}
        onCancel={() => setAssetPickerOpen(false)}
        searchPlaceholder="Search assets..."
        emptyText="No assets yet."
      />

      <PickerSheet
        visible={partPickerOpen}
        title="Choose Part"
        items={parts}
        selectedId={draft.partId}
        searchKeys={['name', 'sku']}
        onSelect={(pid) => {
          setDraft({ ...draft, partId: pid });
          setPartPickerOpen(false);
        }}
        onSelectNone={() => {
          setDraft({ ...draft, partId: null });
          setPartPickerOpen(false);
        }}
        noneLabel="None (no part linked)"
        onAddNew={() => {
          setPartPickerOpen(false);
          // Route to New Part with filterId so the new part links to this
          // filter on save. Pending-id flow auto-selects it on return.
          router.push({ pathname: '/part/new', params: { filterId: id } });
        }}
        addNewLabel="+ Add new part"
        onCancel={() => setPartPickerOpen(false)}
        searchPlaceholder="Search by name or SKU..."
        emptyText="No parts yet."
      />
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

    // Picker rows — replace the chip wraps. Same visual weight as inputs so
    // the form feels uniform.
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 13, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card,
    },
    pickerValue: { fontSize: 16, color: t.ink, flex: 1, marginRight: 8 },
    pickerPlaceholder: { color: t.muted },
    chev: { fontSize: 22, color: t.muted },

    hint: { fontSize: 12, color: t.muted, marginTop: 10, paddingLeft: 13 },

    // Destructive action at the bottom of the form. Same metrics that the
    // Part detail uses for its (now edit-mode-only) Delete Part button.
    delBtn: { marginTop: 28, padding: 12, alignItems: 'center' },
    delTxt: { color: '#dc2626', fontSize: 14 },
  });
}