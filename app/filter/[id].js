// app/filter/[id].js — Filter Detail.
//
// Mark Replaced is IN THE SCROLL FLOW (not pinned).
//
// Notes (in flow, never overlapped) appears in one of two places depending on
// whether the filter has a linked part:
//   - NO part: a right-justified "Notes ›" on its own line below the data
//     card. The button's top margin is trimmed (s.markBtnNotesTop) so the
//     Notes occupies the space rather than leaving a big empty gap.
//   - HAS a part: "Notes ›" rides on the PART section-header row (PART on the
//     left, Notes on the right), so it doesn't add a separate line of height
//     and PART sits at its normal position. s.notesNudge applies a small
//     vertical nudge to the inline Notes only, to optically center it with the
//     (smaller) PART kicker text.
// The two placements are mutually exclusive.
//
// Alignment: the text's right edge lands on the value column (= "May 6, 2026")
// via paddingRight:16 / the header row's right padding. The chevron is
// positioned absolutely at left:'100%' so it floats into the gutter without
// shifting the text's right edge.
//
// Notes are authored on the Edit screen; the affordance only appears when
// notes exist. Tapping opens NotesModal (read-only, dimmed sheet, Copy pill).

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { TypeIcon } from '../../theme/Icons';
import { BackButton, PillButton } from '../../components/HeaderBits';
import DatePickerModal from '../../components/DatePickerModal';
import NotesModal from '../../components/NotesModal';
import {
  loadData, saveData, statusOf, markReplaced, getPart, isPartLow,
  FILTER_TYPES,
} from '../../data/store';

export default function FilterDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

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
  const hasNotes = !!(f.notes && f.notes.trim());
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const onConfirmDate = async (date) => {
    const safe = date > new Date() ? new Date() : date;
    const next = markReplaced(data, f.id, safe.toISOString());
    setData(next);
    setPickerOpen(false);
    await saveData(next);
  };

  // Shared Notes affordance (text + floating chevron). `style` lets the inline
  // (PART-row) placement apply a small vertical nudge.
  const NotesAffordance = ({ style }) => (
    <Pressable
      onPress={() => setNotesOpen(true)}
      hitSlop={{ top: 8, bottom: 8, left: 24, right: 8 }}
      style={style}
    >
      <View style={s.notesInner}>
        <Text style={s.notesLinkTxt}>Notes</Text>
        <Text style={s.notesChev}>›</Text>
      </View>
    </Pressable>
  );

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

        {/* No part → Notes on its own line below the card. */}
        {hasNotes && !part && (
          <View style={s.notesRow}>
            <NotesAffordance />
          </View>
        )}

        {part && (
          <>
            {/* Has part → PART on the left, Notes on the right, one line. */}
            <View style={s.partHeaderRow}>
              <Text style={s.partLabel}>PART</Text>
              {hasNotes && <NotesAffordance style={s.notesNudge} />}
            </View>
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

        <Pressable
          style={[s.markBtn, (hasNotes && !part) && s.markBtnNotesTop]}
          onPress={() => setPickerOpen(true)}
        >
          <Text style={s.markBtnTxt}>✓ Mark Replaced</Text>
        </Pressable>
      </ScrollView>

      <DatePickerModal
        visible={pickerOpen}
        initialDate={new Date()}
        maximumDate={new Date()}
        title="Install Date"
        onCancel={() => setPickerOpen(false)}
        onConfirm={onConfirmDate}
      />

      <NotesModal
        visible={notesOpen}
        notes={f.notes || ''}
        title="Notes"
        onCancel={() => setNotesOpen(false)}
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
    // Canonical screen title — 26/800/0.5. Matches Settings, Due Soon, etc.
    title: { ...t.type.screenTitle, color: t.ink, marginTop: 14, paddingLeft: 16 },

    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: t.radius.pill },
    pillTxt: { ...t.type.pill },

    rows: { marginTop: 22, backgroundColor: t.card, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: t.line },

    // No-part: Notes on its own line. paddingRight:16 right-aligns the text to
    // the value column; marginTop is the small gap below the card.
    notesRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 16, marginTop: 14 },

    // Has-part: PART header row carries PART (left) + Notes (right) on one line.
    // marginTop is the gap below the data card — tune to taste.
    partHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8, paddingHorizontal: 16 },
    partLabel: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase' },

    // Vertical nudge for the INLINE (PART-row) Notes only, to optically center
    // it with the smaller PART kicker. More negative = higher.
    notesNudge: { transform: [{ translateY: -16 }] },

    // Positioning context for the absolute chevron; sizes to the text width.
    notesInner: { alignSelf: 'flex-end' },
    notesLinkTxt: { color: t.ink, fontSize: 14, fontWeight: '700' },
    // Chevron floats just right of the text (left:'100%'), into the gutter.
    notesChev: { position: 'absolute', left: '100%', marginLeft: 4, top: -1, color: t.muted, fontSize: 17, lineHeight: 18, fontWeight: '700' },

    partCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 14 },
    partName: { fontSize: 15, fontWeight: '700', color: t.ink },
    partMeta: { fontSize: 12, color: t.muted, marginTop: 3 },
    partStockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    partStock: { fontSize: 12.5, color: t.inkSoft, fontWeight: '600' },
    lowPill: { backgroundColor: t.status.amb.pillBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    lowPillTxt: { color: t.status.amb.pillInk, fontSize: 11, fontWeight: '700' },
    chev: { fontSize: 22, color: t.muted, marginLeft: 8 },

    // Grey button, inset 16 each side. Default top margin matches no-notes.
    markBtn: { marginTop: 22, marginHorizontal: 16, backgroundColor: t.tabIdleBg, padding: 14, borderRadius: t.radius.btn, alignItems: 'center' },
    // Only when Notes is on its own line (no part): the Notes already separates
    // the button from the card, so trim the button's top gap.
    markBtnNotesTop: { marginTop: 14 },
    markBtnTxt: { fontSize: 15, fontWeight: '700', color: t.ink },
  });
}