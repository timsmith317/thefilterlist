// app/filter/new.js — New Filter.
// Modal page: extra top padding to clear iOS modal chrome edge.
// Title indented to match Settings/Edit Filter alignment.
//
// Schedule is per-stage (StagesEditor): each stage has an interval (a number +
// a Days/Months/Years unit) and an optional part. One stage looks like the
// classic single-interval form; "+ Add stage" grows it into a multi-cartridge
// unit (e.g. an RO system). The unit is converted to the stored day count on
// save via lib/interval. A stage's part is chosen via the /picker route; the
// pick comes back through lib/pendingPick and is folded into that stage on
// focus. Asset is a filter-level inline chip selection.
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
import StagesEditor from '../../components/StagesEditor';
import { loadData, saveData, addFilter, FILTER_TYPES, partsList } from '../../data/store';
import { intervalToDays } from '../../lib/interval';
import { consumePendingPick } from '../../lib/pendingPick';

let _sid = 0;
const newStageId = () => 'st_' + Date.now().toString(36) + '_' + (_sid++);
// New stages default to "90 Days" (the historical default), unit Days.
const freshStage = () => ({ id: newStageId(), value: '90', unit: 'days', partId: null });

export default function NewFilter() {
  const t = useTheme();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);

  // Initialize the draft on first focus; on later focus (returning from the
  // part picker / + Add new part) consume any pending pick into the draft.
  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => {
      if (!active) return;
      setData(d);
      if (!draft) {
        const live = d.assets.find(a => !a.archived);
        setDraft({
          name: '',
          type: 'air',
          assetId: live ? live.id : null,
          notes: '',
          stages: [freshStage()],
        });
      } else {
        const pick = consumePendingPick();
        if (pick) {
          setDraft(prev => {
            if (pick.field === 'asset') return { ...prev, assetId: pick.value };
            if (pick.field === 'part') return {
              ...prev,
              stages: prev.stages.map(st => st.id === pick.stageId ? { ...st, partId: pick.value } : st),
            };
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
  const parts = partsList(data);

  const setStageValue = (id, v) =>
    setDraft(prev => ({ ...prev, stages: prev.stages.map(st => st.id === id ? { ...st, value: v } : st) }));
  const setStageUnit = (id, u) =>
    setDraft(prev => ({ ...prev, stages: prev.stages.map(st => st.id === id ? { ...st, unit: u } : st) }));
  const addStage = () =>
    setDraft(prev => ({ ...prev, stages: [...prev.stages, freshStage()] }));
  const removeStage = (id) =>
    setDraft(prev => ({ ...prev, stages: prev.stages.length > 1 ? prev.stages.filter(st => st.id !== id) : prev.stages }));
  const pickPart = (stageId) => {
    const st = draft.stages.find(x => x.id === stageId);
    router.push({ pathname: '/picker', params: { kind: 'part', selectedId: st?.partId || '', stageId } });
  };

  const onSave = async () => {
    const stages = draft.stages.map(st => ({
      id: st.id,
      intervalDays: intervalToDays(st.value, st.unit),
      partId: st.partId || null,
    }));
    const next = addFilter(data, {
      assetId: draft.assetId || liveAssets[0]?.id,
      name: (draft.name.trim() || FILTER_TYPES[draft.type].label + ' Filter'),
      type: draft.type,
      notes: '',
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
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>New Filter</Text>
        <Text style={s.sub}>Set up a replacement schedule and link an optional part.</Text>

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
          placeholder={FILTER_TYPES[draft.type].label + ' Filter'}
          placeholderTextColor={t.muted}
          value={draft.name}
          onChangeText={(v) => setDraft({ ...draft, name: v })}
        />

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

        <StagesEditor
          stages={draft.stages}
          parts={parts}
          onSetValue={setStageValue}
          onSetUnit={setStageUnit}
          onAddStage={addStage}
          onRemoveStage={removeStage}
          onPickPart={pickPart}
        />
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
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: t.radius.chip, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    typeChipOn: { backgroundColor: t.tabIdleBg },
    typeLabel: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    typeLabelOn: { color: t.ink, fontWeight: '700' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    chipOn: { backgroundColor: t.tabIdleBg },
    chipTxt: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    chipTxtOn: { color: t.ink, fontWeight: '700' },
  });
}
