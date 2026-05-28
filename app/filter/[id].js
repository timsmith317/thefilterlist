// app/filter/[id].js — Filter Detail.
//
// Mark Replaced button restyled:
//   - Grey background (matches pill style elsewhere)
//   - Inset with marginHorizontal: 16 so its edges align with the title text
//     above (which sits at paddingLeft: 16 inside the paddingHorizontal: 18
//     page padding), not the wider data rows card.

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { TypeIcon } from '../../theme/Icons';
import { BackButton, PillButton } from '../../components/HeaderBits';
import DatePickerModal from '../../components/DatePickerModal';
import {
  loadData, saveData, statusOf, markReplaced, deleteFilter, getPart, isPartLow,
  FILTER_TYPES,
} from '../../data/store';

export default function FilterDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, []));

  const s = makeStyles(t);

  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const f = data.filters.find(x => x.id === id);
  if (!f) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.head}><BackButton onPress={() => router.back()} /><View /></View>
        <Text style={{ color: t.ink, padding: 22 }}>Filter not found.</Text>
      </SafeAreaView>
    );
  }

  const status = statusOf(f);
  const tone = t.status[status.key];
  const asset = data.assets.find(a => a.id === f.assetId);
  const part = getPart(data, f.partId);
  const partLow = isPartLow(part);
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const onConfirmDate = async (date) => {
    const safe = date > new Date() ? new Date() : date;
    const next = markReplaced(data, f.id, safe.toISOString());
    setData(next);
    setPickerOpen(false);
    await saveData(next);
  };

  const onDelete = async () => {
    const n = deleteFilter(data, f.id);
    await saveData(n);
    router.back();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <PillButton label="Edit" onPress={() => router.push(`/filter/edit/${f.id}`)} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40, paddingTop: 4 }}>
        <View style={s.bigChip}><TypeIcon type={f.type} size={52} color={t.iconInk} /></View>
        <Text style={s.title}>{f.name}</Text>
        <View style={[s.pill, { backgroundColor: tone.pillBg, alignSelf: 'flex-start', marginTop: 8, marginLeft: 16 }]}>
          <Text style={[s.pillTxt, { color: tone.pillInk }]}>{status.label}</Text>
        </View>

        <View style={s.rows}>
          <Row t={t} k="Location" v={asset?.name || '—'} />
          <Row t={t} k="Type" v={FILTER_TYPES[f.type]?.label || 'Other'} />
          <Row t={t} k="Replace every" v={`${f.intervalDays} days`} />
          <Row t={t} k="Last replaced" v={fmt(f.lastReplaced)} />
          <Row t={t} k="Next due" v={fmt(status.due)} last />
        </View>

        {part && (
          <>
            <Text style={s.sectionLabel}>PART</Text>
            <Pressable style={s.partCard} onPress={() => router.push(`/part/${part.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={s.partName} numberOfLines={1}>{part.name || 'Untitled part'}</Text>
                {!!part.sku && <Text style={s.partMeta}>SKU: {part.sku}</Text>}
                <View style={s.partStockRow}>
                  <Text style={s.partStock}>On hand: {part.onHand}</Text>
                  {partLow && (
                    <View style={s.lowPill}><Text style={s.lowPillTxt}>Low stock</Text></View>
                  )}
                </View>
              </View>
              <Text style={s.chev}>›</Text>
            </Pressable>
          </>
        )}

        <Pressable style={s.markBtn} onPress={() => setPickerOpen(true)}>
          <Text style={s.markBtnTxt}>✓ Mark Replaced</Text>
        </Pressable>
        <Text style={s.hint}>Tap to choose the install date.</Text>

        <Pressable style={s.delBtn} onPress={onDelete}>
          <Text style={s.delTxt}>Delete Filter</Text>
        </Pressable>
      </ScrollView>

      <DatePickerModal
        visible={pickerOpen}
        initialDate={new Date()}
        maximumDate={new Date()}
        title="Install date"
        onCancel={() => setPickerOpen(false)}
        onConfirm={onConfirmDate}
      />
    </SafeAreaView>
  );
}

function Row({ t, k, v, last }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      <Text style={{ color: t.muted, fontSize: 14 }}>{k}</Text>
      <Text style={{ color: t.ink, fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },

    bigChip: { width: 76, height: 76, borderRadius: 18, backgroundColor: t.iconBg, borderWidth: 1.5, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginLeft: 16 },
    title: { ...t.type.title, fontSize: 28, color: t.ink, marginTop: 14, paddingLeft: 16 },

    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: t.radius.pill },
    pillTxt: { ...t.type.pill },

    rows: { marginTop: 22, backgroundColor: t.card, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: t.line },

    sectionLabel: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 16 },
    partCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 14 },
    partName: { fontSize: 15, fontWeight: '700', color: t.ink },
    partMeta: { fontSize: 12, color: t.muted, marginTop: 3 },
    partStockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    partStock: { fontSize: 12.5, color: t.inkSoft, fontWeight: '600' },
    lowPill: { backgroundColor: t.status.amb.pillBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    lowPillTxt: { color: t.status.amb.pillInk, fontSize: 11, fontWeight: '700' },
    chev: { fontSize: 22, color: t.muted, marginLeft: 8 },

    // Grey button, inset 16 on each side so edges align with the title text
    // above (title sits at paddingLeft: 16 inside paddingHorizontal: 18 page).
    markBtn: { marginTop: 22, marginHorizontal: 16, backgroundColor: t.tabIdleBg, padding: 14, borderRadius: t.radius.btn, alignItems: 'center' },
    markBtnTxt: { fontSize: 15, fontWeight: '700', color: t.ink },
    hint: { fontSize: 12, color: t.muted, marginTop: 8, textAlign: 'center' },

    delBtn: { marginTop: 22, padding: 12, alignItems: 'center' },
    delTxt: { color: '#dc2626', fontSize: 14 },
  });
}
