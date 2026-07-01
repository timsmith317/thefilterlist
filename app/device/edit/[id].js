// app/device/edit/[id].js — Edit Device.
//
// A device is the set of FILTERS it contains. The FILTERS section opens a
// multi-select picker (/picker?kind=filter&multi=1); each checked filter becomes a
// tracked line (a stage). The replacement interval lives on the FILTER (edited on
// the Filter screen) and is shown read-only beside each one — there is no
// device-level interval. A device with NO filters simply has no schedule; to
// track something by hand, use the Notes field.
//
// LAST REPLACED (onboarding):
//   Each attached filter row is tappable and opens the same DatePickerModal that
//   Mark Replaced uses, letting you set WHEN that filter was last replaced. This
//   is the natural home for onboarding existing equipment with past dates —
//   Mark Replaced on the Detail screen stays the one-tap "I just swapped it now"
//   action; this is the "set the real history" action. Each row shows a
//   "Last replaced: …" line so you can see exactly what the app has recorded
//   (or "Not set" — which is the case the store would otherwise silently stamp
//   as today on save, the exact thing that felt unintuitive).
//
//   The date is a per-STAGE fact, not a filter fact: the same filter used by two
//   devices has its own last-replaced date on each. So this lives here (the
//   device editor, where a row == a stage), NOT on the shared Filter screen.
//   The picked date is written into draft.preserved[filterId].lastReplaced,
//   which save() already round-trips into the stage.
//
// Each existing filter keeps its stage id + lastReplaced (history preserved);
// newly-attached filters start fresh (the store stamps lastReplaced on save
// unless we set one here). Removing every filter saves an empty stages array.
//
// Asset is selected via the single-select /picker route. Picks come back via
// lib/pendingPick on focus:
//   asset -> { field:'asset', value }
//   filters -> { field:'filters', values:[...] }  (the multi picker's Done)
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
import ManualPickerModal from '../../../components/ManualPickerModal';
import IconPickerModal from '../../../components/IconPickerModal';
import DatePickerModal from '../../../components/DatePickerModal';
import { DeviceIcon } from '../../../theme/Icons';
import { loadData, saveData, updateDevice, deleteDevice, filtersList, deviceStages, deviceDisplayType, DEFAULT_INTERVAL_DAYS } from '../../../data/store';
import { persistManualFile, deleteManualFile, manualSummary } from '../../../lib/manualFile';
import { formatInterval } from '../../../lib/interval';
import { consumePendingPick } from '../../../lib/pendingPick';

let _sid = 0;
const newStageId = () => 'st_' + Date.now().toString(36) + '_' + (_sid++);

// Same date format the Detail screens use, so "Last replaced: …" reads
// identically wherever it appears.
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function EditDevice() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  // Which filter's last-replaced date we're editing (filterId), or null.
  const [dateFor, setDateFor] = useState(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => {
      if (!active) return;
      setData(d);
      if (!draft || !Array.isArray(draft.filterIds)) {
        const f = d.devices.find(x => x.id === id);
        if (f) {
          const stages = deviceStages(f);
          const preserved = {};
          const filterIds = [];
          stages.forEach(st => {
            if (st.filterId && !preserved[st.filterId]) {
              preserved[st.filterId] = { id: st.id, lastReplaced: st.lastReplaced };
              filterIds.push(st.filterId);
            }
          });
          // Keep the first filterless stage's identity so marking replaced
          // still has something to stamp when no filters are attached.
          const filterlessStage = stages.find(s => !s.filterId) || null;
          setDraft({
            name: f.name,
            assetId: f.assetId,
            model: f.model || '',
            serial: f.serial || '',
            productUrl: f.productUrl || '',
            manualUrl: f.manualUrl || '',
            manualFile: f.manualFile || null,
            icon: f.icon || null,
            notes: f.notes || '',
            filterIds,
            preserved,
            filterlessMeta: filterlessStage
              ? { id: filterlessStage.id, lastReplaced: filterlessStage.lastReplaced }
              : null,
          });
        }
      } else {
        const pick = consumePendingPick();
        if (pick) {
          setDraft(prev => {
            if (pick.field === 'asset') return { ...prev, assetId: pick.value };
            if (pick.field === 'filters') return { ...prev, filterIds: pick.values || [] };
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
  const filters = filtersList(data);
  const currentAsset = assets.find(a => a.id === draft.assetId);
  const filterIds = draft.filterIds || [];
  const selectedFilters = filterIds
    .map(pid => filters.find(p => p.id === pid))
    .filter(Boolean);
  // Preview of the icon Auto would derive from the currently-picked filters.
  const autoType = deviceDisplayType({ stages: filterIds.map(id => ({ filterId: id })) }, data);

  // The last-replaced date currently held for a given filter (from an existing
  // stage, or one just set in this editing session). Undefined for a freshly
  // attached filter that hasn't been given a date yet -> shows "Not set".
  const lastReplacedFor = (pid) => (draft.preserved[pid] || {}).lastReplaced || null;

  const openAssetPicker = () =>
    router.push({ pathname: '/picker', params: { kind: 'asset', selectedId: draft.assetId || '', deviceId: id } });

  const openFiltersPicker = () =>
    router.push({ pathname: '/picker', params: { kind: 'filter', multi: '1', selectedIds: filterIds.join(',') } });

  // Write the picked date into preserved[pid]. save() reads this back into the
  // stage; a freshly-attached filter with no preserved entry gets one here
  // (no stage id yet — save() mints one via newStageId()).
  const onConfirmDate = (date) => {
    const pid = dateFor;
    if (!pid) { setDateFor(null); return; }
    const safe = date > new Date() ? new Date() : date;   // never future
    setDraft(prev => {
      const preserved = { ...prev.preserved };
      preserved[pid] = { ...(preserved[pid] || {}), lastReplaced: safe.toISOString() };
      return { ...prev, preserved };
    });
    setDateFor(null);
  };

  const save = async () => {
    // Filters are the only schedule source. No filters -> a single filterless stage
    // acts as a "last replaced" tracker (no interval shown, no schedule).
    const stages = filterIds.length
      ? filterIds.map(pid => {
          const prev = draft.preserved[pid];
          const filter = filters.find(p => p.id === pid);
          return {
            id: (prev && prev.id) || newStageId(),
            filterId: pid,
            intervalDays: (filter && typeof filter.intervalDays === 'number') ? filter.intervalDays : DEFAULT_INTERVAL_DAYS,
            ...((prev && prev.lastReplaced) ? { lastReplaced: prev.lastReplaced } : null),
          };
        })
      : [{
          id: (draft.filterlessMeta && draft.filterlessMeta.id) || newStageId(),
          filterId: null,
          intervalDays: DEFAULT_INTERVAL_DAYS,
          ...((draft.filterlessMeta && draft.filterlessMeta.lastReplaced) ? { lastReplaced: draft.filterlessMeta.lastReplaced } : null),
        }];
    // Persist a freshly-picked manual file; if a saved file was replaced or
    // removed, delete the old one so it doesn't linger.
    let manualFile = draft.manualFile;
    if (manualFile) manualFile = await persistManualFile(manualFile);
    const origFile = (data.devices.find(x => x.id === id) || {}).manualFile;
    if (origFile && (!manualFile || manualFile.uri !== origFile.uri)) {
      await deleteManualFile(origFile.uri);
    }

    const patch = {
      name: draft.name.trim() || draft.name,
      assetId: draft.assetId,
      model: (draft.model || '').trim(),
      serial: (draft.serial || '').trim(),
      productUrl: (draft.productUrl || '').trim(),
      manualUrl: (draft.manualUrl || '').trim(),
      manualFile: manualFile || null,
      icon: draft.icon || null,
      notes: (draft.notes || '').trim(),
      stages,
    };
    const next = updateDevice(data, id, patch);
    await saveData(next);
    router.back();
  };

  const askDelete = () => {
    Alert.alert(
      'Delete device?',
      `This will remove "${draft.name}" and its replacement history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const f0 = data.devices.find(x => x.id === id);
            if (f0 && f0.manualFile) await deleteManualFile(f0.manualFile.uri);
            const next = deleteDevice(data, id);
            await saveData(next);
            router.back();
            setTimeout(() => router.back(), 0);
          },
        },
      ]
    );
  };

  // Title + initial date for the date sheet (name of the filter being edited).
  const dateForFilter = dateFor ? filters.find(p => p.id === dateFor) : null;
  const dateForCurrent = dateFor ? lastReplacedFor(dateFor) : null;

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
        <Text style={s.title}>Edit Device</Text>
        <Text style={s.sub}>Change the filters, location, or notes.</Text>

        <View style={s.nameRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>NAME</Text>
            <TextInput
              style={s.input}
              value={draft.name}
              onChangeText={(v) => setDraft({ ...draft, name: v })}
              placeholderTextColor={t.muted}
            />
          </View>
          <View>
            <Text style={[s.label, s.iconLabel]}>ICON</Text>
            <Pressable onPress={() => setIconOpen(true)} hitSlop={10} style={s.iconBox}>
              <DeviceIcon iconName={draft.icon} displayType={autoType} size={28} color={t.iconInk} />
            </Pressable>
          </View>
        </View>

        <Text style={s.label}>ASSET</Text>
        <Pressable style={s.pickerRow} onPress={openAssetPicker}>
          <Text style={[s.pickerValue, !currentAsset && s.pickerPlaceholder]} numberOfLines={1}>
            {currentAsset ? currentAsset.name : 'Choose asset'}
          </Text>
          <Text style={s.chev}>›</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>MODEL</Text>
            <TextInput style={s.input} value={draft.model} onChangeText={(v) => setDraft({ ...draft, model: v })} placeholder="e.g. WRX735SDHZ" placeholderTextColor={t.muted} autoCapitalize="characters" autoCorrect={false} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>SERIAL</Text>
            <TextInput style={s.input} value={draft.serial} onChangeText={(v) => setDraft({ ...draft, serial: v })} placeholder="e.g. HRA0412345" placeholderTextColor={t.muted} autoCapitalize="characters" autoCorrect={false} />
          </View>
        </View>

        <Text style={s.label}>FILTERS</Text>
        <Pressable style={s.pickerRow} onPress={openFiltersPicker}>
          <Text style={[s.pickerValue, selectedFilters.length === 0 && s.pickerPlaceholder]} numberOfLines={1}>
            {selectedFilters.length === 0
              ? 'Attach filters'
              : (selectedFilters.length === 1 ? '1 filter attached' : `${selectedFilters.length} filters attached`)}
          </Text>
          <Text style={s.chev}>›</Text>
        </Pressable>

        {selectedFilters.length > 0 && (
          <View style={s.filtersBox}>
            {selectedFilters.map((p, i) => {
              const lr = lastReplacedFor(p.id);
              return (
                // Tap a filter to set when it was last replaced (opens the same
                // date sheet as Mark Replaced). The "Last replaced" line below
                // is the visual confirmation of what the app has recorded.
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [s.filterRow, i > 0 && s.filterRowDivider, pressed && s.filterRowPressed]}
                  onPress={() => setDateFor(p.id)}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.filterName} numberOfLines={1}>{p.name || 'Untitled filter'}</Text>
                    <Text style={s.filterSub} numberOfLines={1}>
                      Every {formatInterval(p.intervalDays != null ? p.intervalDays : DEFAULT_INTERVAL_DAYS)}
                      {p.sku ? `  ·  ${p.sku}` : ''}
                    </Text>
                    <Text style={s.lastReplaced} numberOfLines={1}>
                      Last replaced: <Text style={lr ? s.lrSet : s.lrUnset}>{lr ? fmtDate(lr) : 'Not set'}</Text>
                    </Text>
                  </View>
                  <Text style={s.chev}>›</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={s.hint}>
          Attach a filter to track stock, reorders, and replacement intervals.
          Tap a filter to set when it was last replaced.
        </Text>

        <Text style={s.label}>PRODUCT URL</Text>
        <TextInput style={s.input} value={draft.productUrl} onChangeText={(v) => setDraft({ ...draft, productUrl: v })} placeholder="Product or support page" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" />

        <Text style={s.label}>OWNER'S MANUAL</Text>
        <Pressable style={s.pickerRow} onPress={() => setManualOpen(true)}>
          <Text style={[s.pickerValue, !(draft.manualUrl || draft.manualFile) && s.pickerPlaceholder]} numberOfLines={1}>
            {manualSummary(draft.manualUrl, draft.manualFile)}
          </Text>
          <Text style={s.chev}>›</Text>
        </Pressable>

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
          <Text style={s.delTxt}>Delete Device</Text>
        </Pressable>
      </KeyboardAwareScrollView>

      <ManualPickerModal
        visible={manualOpen}
        value={{ url: draft.manualUrl, file: draft.manualFile }}
        onCancel={() => setManualOpen(false)}
        onSave={({ url, file }) => { setDraft({ ...draft, manualUrl: url, manualFile: file }); setManualOpen(false); }}
      />

      <IconPickerModal
        visible={iconOpen}
        value={draft.icon}
        onCancel={() => setIconOpen(false)}
        onSave={(name) => { setDraft({ ...draft, icon: name }); setIconOpen(false); }}
      />

      {/* Same date sheet as Mark Replaced. initialDate = the stage's current
          last-replaced (or today for a fresh one); capped at today. */}
      <DatePickerModal
        visible={!!dateFor}
        initialDate={dateForCurrent ? new Date(dateForCurrent) : new Date()}
        maximumDate={new Date()}
        title={dateForFilter ? (dateForFilter.name || 'Last Replaced') : 'Last Replaced'}
        onCancel={() => setDateFor(null)}
        onConfirm={onConfirmDate}
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
    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 13 },
    input: { height: 50, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },
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
      height: 50, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card,
    },
    pickerValue: { fontSize: 16, color: t.ink, flex: 1, marginRight: 8 },
    pickerPlaceholder: { color: t.muted },
    chev: { fontSize: 20, lineHeight: 22, color: t.muted },
    nameRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    iconLabel: { paddingLeft: 0, textAlign: 'center' },
    // Icon box border matches the index-page icon chips (t.iconBorder +
    // t.radius.chip), not the lighter t.line of the text fields beside it.
    iconBox: { width: 50, height: 50, borderRadius: t.radius.chip, backgroundColor: t.iconBg, borderWidth: 1.5, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center' },

    // Selected-filters list (each filter = a tracked line / stage). Rows are
    // now tappable (set last-replaced), so they carry a chevron + pressed state.
    filtersBox: { marginTop: 10, backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.line, paddingHorizontal: 14 },
    filterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    filterRowDivider: { borderTopWidth: 1, borderTopColor: t.line },
    filterRowPressed: { backgroundColor: t.tabIdleBg },
    filterName: { fontSize: 15, fontWeight: '700', color: t.ink },
    filterSub: { fontSize: 12.5, color: t.muted, marginTop: 3 },
    // Last-replaced confirmation line. "Not set" is muted/italic to flag the
    // onboarding case; a real date reads in ink so it's clearly recorded.
    lastReplaced: { fontSize: 12.5, color: t.muted, marginTop: 6 },
    lrSet: { color: t.ink, fontWeight: '700' },
    lrUnset: { color: t.muted, fontStyle: 'italic', fontWeight: '600' },

    hint: { fontSize: 12, color: t.muted, marginTop: 10, paddingLeft: 13 },

    delBtn: { marginTop: 28, padding: 12, alignItems: 'center' },
    delTxt: { color: '#dc2626', fontSize: 14 },
  });
}