// app/filter/[id].js — Filter Detail.
// - Stronger "Back" button (big chevron + label).
// - "Mark Replaced" opens a native date picker (default today, no future dates).
// - Part row is a tappable card → Part Detail; shows on-hand and low-stock badge.
// - Edit button (top right) → Edit Filter (reuses /filter/new with edit mode).

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../theme/theme';
import { TypeIcon, IconBack } from '../../theme/Icons';
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

  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const f = data.filters.find(x => x.id === id);
  const s = makeStyles(t);
  if (!f) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
          <IconBack size={26} color={t.ink} />
          <Text style={s.backTxt}>Back</Text>
        </Pressable>
        <Text style={{ color: t.ink, marginTop: 20, padding: 22 }}>Filter not found.</Text>
      </SafeAreaView>
    );
  }

  const status = statusOf(f);
  const tone = t.status[status.key];
  const asset = data.assets.find(a => a.id === f.assetId);
  const part = getPart(data, f.partId);
  const partLow = isPartLow(part);
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const onPickDate = async (_event, date) => {
    // iOS: this fires whenever the spinner changes. We close on confirm via the
    // overlay button. To keep behavior simple/cross-platform, save when date
    // arrives and close. (User can cancel by tapping outside on iOS.)
    if (!date) { setPickerOpen(false); return; }
    setPickerOpen(false);
    // Disallow future dates defensively (picker is also constrained by maximumDate)
    const safe = date > new Date() ? new Date() : date;
    const next = markReplaced(data, f.id, safe.toISOString());
    setData(next);
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
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10}>
          <IconBack size={26} color={t.ink} />
          <Text style={s.backTxt}>Back</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/filter/edit/${f.id}`)} hitSlop={10}>
          <Text style={s.editTxt}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}>
        <View style={s.bigChip}><TypeIcon type={f.type} size={34} color={t.iconInk} /></View>
        <Text style={s.title}>{f.name}</Text>
        <View style={[s.pill, { backgroundColor: tone.pillBg, alignSelf: 'flex-start', marginTop: 8 }]}>
          <Text style={[s.pillTxt, { color: tone.pillInk }]}>{status.label}</Text>
        </View>

        <View style={s.rows}>
          <Row t={t} k="Location" v={asset?.name || '—'} />
          <Row t={t} k="Type" v={FILTER_TYPES[f.type]?.label || 'Other'} />
          <Row t={t} k="Replace every" v={`${f.intervalDays} days`} />
          <Row t={t} k="Last replaced" v={fmt(f.lastReplaced)} />
          <Row t={t} k="Next due" v={fmt(status.due)} last />
        </View>

        {/* Part card — tappable to open Part Detail; shows on-hand and low-stock badge */}
        <Text style={s.sectionLabel}>PART</Text>
        {part ? (
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
        ) : (
          <Pressable style={s.partAddCard} onPress={() => router.push(`/part/new?filterId=${f.id}`)}>
            <Text style={s.partAddTxt}>+ Add a part for reorder tracking</Text>
          </Pressable>
        )}

        <Pressable style={s.bigBtn} onPress={() => setPickerOpen(true)}>
          <Text style={s.bigBtnTxt}>✓ Mark Replaced</Text>
        </Pressable>
        <Text style={s.hint}>Tap to choose the install date (default today, no future dates).</Text>

        <Pressable style={s.delBtn} onPress={onDelete}>
          <Text style={s.delTxt}>Delete filter</Text>
        </Pressable>
      </ScrollView>

      {pickerOpen && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={onPickDate}
        />
      )}
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
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 6 },
    backTxt: { color: t.ink, fontSize: 16, fontWeight: '600' },
    editTxt: { color: t.ink, fontSize: 15, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 6 },

    bigChip: { width: 64, height: 64, borderRadius: 16, backgroundColor: t.iconBg, borderWidth: 1.5, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    title: { ...t.type.title, fontSize: 28, color: t.ink, marginTop: 14 },

    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: t.radius.pill },
    pillTxt: { ...t.type.pill },

    rows: { marginTop: 22, backgroundColor: t.card, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: t.line },

    sectionLabel: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
    partCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 14 },
    partName: { fontSize: 15, fontWeight: '700', color: t.ink },
    partMeta: { fontSize: 12, color: t.muted, marginTop: 3 },
    partStockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    partStock: { fontSize: 12.5, color: t.inkSoft, fontWeight: '600' },
    lowPill: { backgroundColor: t.status.amb.pillBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    lowPillTxt: { color: t.status.amb.pillInk, fontSize: 11, fontWeight: '700' },
    chev: { fontSize: 22, color: t.muted, marginLeft: 8 },
    partAddCard: { backgroundColor: t.card, borderWidth: 1, borderStyle: 'dashed', borderColor: t.iconBorder, borderRadius: 14, padding: 16, alignItems: 'center' },
    partAddTxt: { color: t.inkSoft, fontSize: 14, fontWeight: '600' },

    bigBtn: { marginTop: 22, backgroundColor: t.btnBg, padding: 16, borderRadius: t.radius.btn, alignItems: 'center' },
    bigBtnTxt: { ...t.type.btn, color: t.btnInk },
    hint: { fontSize: 12, color: t.muted, marginTop: 8, textAlign: 'center' },

    delBtn: { marginTop: 22, padding: 12, alignItems: 'center' },
    delTxt: { color: '#dc2626', fontSize: 14 },
  });
}
