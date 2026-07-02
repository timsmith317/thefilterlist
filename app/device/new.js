// app/device/new.js — New Device.
// Modal page: extra top padding to clear iOS modal chrome edge.
//
// Mirrors Edit Device's model: a device is the set of FILTERS it contains. The
// FILTERS section opens a multi-select picker (/picker?kind=filter&multi=1); each
// checked filter becomes a tracked line (a stage) whose interval comes from the
// FILTER (edited on the Filter screen). There is no device-level interval and no
// "add stage" — multiple filters cover multiple cartridges. A device created with
// NO filters is a basic device: no schedule, but it can still be marked replaced
// (a single filterless stage holds the date); use Notes for anything by hand.
//
// Asset is chosen inline (chips). Filter picks come back via lib/pendingPick on
// focus: { field:'filters', values:[...] }.
//
// Keyboard handling: KeyboardAwareScrollView (react-native-keyboard-controller)
// scrolls the focused input clear of the keyboard. Requires <KeyboardProvider>
// in app/_layout.js. Native module — needs a dev rebuild to take effect.

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { PillButton } from '../../components/HeaderBits';
import ManualPickerModal from '../../components/ManualPickerModal';
import IconPickerModal from '../../components/IconPickerModal';
import { DeviceIcon } from '../../theme/Icons';
import { loadData, saveData, addDevice, filtersList, deviceDisplayType, DEFAULT_INTERVAL_DAYS } from '../../data/store';
import { persistManualFile, manualSummary } from '../../lib/manualFile';
import { formatInterval } from '../../lib/interval';
import { consumePendingPick } from '../../lib/pendingPick';

let _sid = 0;
const newStageId = () => 'st_' + Date.now().toString(36) + '_' + (_sid++);

export default function NewDevice() {
  const t = useTheme();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);

  // Initialize on first focus; on later focus (returning from the filters picker
  // / + Add new filter) consume any pending pick into the draft.
  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => {
      if (!active) return;
      setData(d);
      if (!draft || !Array.isArray(draft.filterIds)) {
        const live = d.assets.find(a => !a.archived);
        setDraft({
          name: '',
          assetId: live ? live.id : null,
          model: '',
          serial: '',
          productUrl: '',
          manualUrl: '',
          manualFile: null,
          icon: null,
          notes: '',
          filterIds: [],
        });
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
  }, [draft]));

  const s = makeStyles(t);
  if (!data || !draft) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const liveAssets = data.assets.filter(a => !a.archived);
  const filters = filtersList(data);
  const filterIds = draft.filterIds || [];
  const selectedFilters = filterIds
    .map(pid => filters.find(p => p.id === pid))
    .filter(Boolean);
  // Preview of the icon Auto would derive from the currently-picked filters.
  const autoType = deviceDisplayType({ stages: filterIds.map(id => ({ filterId: id })) }, data);

  const openFiltersPicker = () =>
    router.push({ pathname: '/picker', params: { kind: 'filter', multi: '1', selectedIds: filterIds.join(',') } });

  const onSave = async () => {
    // Filters are the only schedule source. No filters -> one filterless stage that
    // can still be marked replaced (no interval, no due date).
    const stages = filterIds.length
      ? filterIds.map(pid => {
          const filter = filters.find(p => p.id === pid);
          return {
            id: newStageId(),
            filterId: pid,
            intervalDays: (filter && typeof filter.intervalDays === 'number') ? filter.intervalDays : DEFAULT_INTERVAL_DAYS,
          };
        })
      : [{ id: newStageId(), filterId: null, intervalDays: DEFAULT_INTERVAL_DAYS }];

    // Persist a freshly-picked manual file into app storage before saving.
    let manualFile = draft.manualFile;
    if (manualFile) manualFile = await persistManualFile(manualFile);

    const next = addDevice(data, {
      assetId: draft.assetId || liveAssets[0]?.id,
      name: (draft.name.trim() || 'Device'),
      model: (draft.model || '').trim(),
      serial: (draft.serial || '').trim(),
      productUrl: (draft.productUrl || '').trim(),
      manualUrl: (draft.manualUrl || '').trim(),
      manualFile: manualFile || null,
      icon: draft.icon || null,
      notes: (draft.notes || '').trim(),
      stages,
    });
    await saveData(next);
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
        <PillButton label="Save" onPress={onSave} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: t.isTablet ? t.ui(32) : 18, paddingBottom: 40 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>New Device</Text>
        <Text style={s.sub}>Pick the filters this device uses — each one tracks its own schedule.</Text>

        <View style={s.nameRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>NAME</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Refrigerator"
              placeholderTextColor={t.muted}
              value={draft.name}
              onChangeText={(v) => setDraft({ ...draft, name: v })}
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
        <View style={s.chipWrap}>
          {liveAssets.map(a => {
            const on = draft.assetId === a.id;
            return (
              <Pressable key={a.id} onPress={() => setDraft({ ...draft, assetId: a.id })} style={[s.chip, on && s.chipOn]}>
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{a.name}</Text>
              </Pressable>
            );
          })}
        </View>

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
            {selectedFilters.map((p, i) => (
              <View key={p.id} style={[s.filterRow, i > 0 && s.filterRowDivider]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.filterName} numberOfLines={1}>{p.name || 'Untitled filter'}</Text>
                  <Text style={s.filterSub} numberOfLines={1}>
                    Every {formatInterval(p.intervalDays != null ? p.intervalDays : DEFAULT_INTERVAL_DAYS)}
                    {p.sku ? `  ·  ${p.sku}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={s.hint}>
          Attach a filter to track stock, reorders, and replacement intervals.
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
    input: { height: t.ui(50), paddingHorizontal: t.ui(13), borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: t.uit(16) },
    notesInput: {
      padding: 13, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: t.uit(16),
      minHeight: t.ui(110), textAlignVertical: 'top',
    },
    typeRow: { flexDirection: 'row', gap: 8 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    chipOn: { backgroundColor: t.tabIdleBg },
    chipTxt: { fontSize: t.uit(13), fontWeight: '600', color: t.inkSoft },
    chipTxtOn: { color: t.ink, fontWeight: '700' },
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      height: t.ui(50), paddingHorizontal: t.ui(13), borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card,
    },
    pickerValue: { fontSize: t.uit(16), color: t.ink, flex: 1, marginRight: 8 },
    pickerPlaceholder: { color: t.muted },
    chev: { fontSize: t.uit(20), lineHeight: 22, color: t.muted },
    nameRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    iconLabel: { paddingLeft: 0, textAlign: 'center' },
    // Icon box border matches the index-page icon chips (t.iconBorder +
    // t.radius.chip), not the lighter t.line of the text fields beside it.
    iconBox: { width: t.ui(50), height: t.ui(50), borderRadius: t.radius.chip, backgroundColor: t.iconBg, borderWidth: 1.5, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center' },
    filtersBox: { marginTop: 10, backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.line, paddingHorizontal: 14 },
    filterRow: { paddingVertical: 12 },
    filterRowDivider: { borderTopWidth: 1, borderTopColor: t.line },
    filterName: { fontSize: t.uit(15), fontWeight: '700', color: t.ink },
    filterSub: { fontSize: t.uit(12.5), color: t.muted, marginTop: 3 },
    hint: { fontSize: t.uit(12), color: t.muted, marginTop: 10, paddingLeft: 13 },
  });
}