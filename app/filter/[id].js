// app/filter/[id].js — Filter Detail.
//
// SINGLE-STAGE filters render exactly as before: a data card (Location / Type /
// Replace every / Last replaced / Next due), one PART card, and a one-tap
// Mark Replaced that opens the date picker.
//
// MULTI-STAGE filters render a STAGES section instead: the data card carries
// Location / Type / Stages / Next due (soonest), then one card per stage —
// each with its own status pill, linked part (SKU / on-hand / low-stock),
// its own interval + next-due, and tap-through to the part. Mark Replaced
// opens the per-stage sheet (check what you swapped, pick a date).
//
// Intervals display in human units (1y / 6m / 30d) via lib/interval.
//
// Notes (authored on Edit; affordance shown only when notes exist):
//   - single, NO part: right-justified "Notes ›" on its own line below the card.
//   - single, HAS part: "Notes ›" rides on the PART header row.
//   - multi: "Notes ›" rides on the STAGES header row.
// Tapping opens NotesModal (read-only, dimmed sheet, Copy pill).

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { TypeIcon } from '../../theme/Icons';
import { BackButton, PillButton } from '../../components/HeaderBits';
import DatePickerModal from '../../components/DatePickerModal';
import MarkReplacedSheet from '../../components/MarkReplacedSheet';
import NotesModal from '../../components/NotesModal';
import {
  loadData, saveData, statusOf, stagesWithStatus, markReplaced, getPart, isPartLow,
  FILTER_TYPES,
} from '../../data/store';
import { formatInterval } from '../../lib/interval';

export default function FilterDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // Hug-then-pin Mark Replaced button (matches the settings screens): inline
  // after the content when it fits, pinned to a bottom footer when it overflows.
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [footerH, setFooterH] = useState(0);

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

  const status = statusOf(f, data);         // headline = soonest-due stage
  const tone = t.status[status.key];
  const stages = stagesWithStatus(f, data); // each {…, status}, soonest first
  const multi = stages.length > 1;
  const noStages = stages.length === 0;     // no parts -> no schedule
  const s0 = stages[0] || null;

  const asset = data.assets.find(a => a.id === f.assetId);
  const part = getPart(data, s0 ? s0.partId : null);   // single-stage part
  const partLow = isPartLow(part);
  const hasNotes = !!(f.notes && f.notes.trim());
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Single-stage: one tap → date picker → reset the (only) stage.
  const onConfirmDate = async (date) => {
    const safe = date > new Date() ? new Date() : date;
    const next = markReplaced(data, f.id, safe.toISOString());
    setData(next);
    setPickerOpen(false);
    await saveData(next);
  };

  // Multi-stage: sheet returns the checked stage ids + a date.
  const onConfirmSheet = async (stageIds, date) => {
    const safe = date > new Date() ? new Date() : date;
    const next = markReplaced(data, f.id, safe.toISOString(), stageIds);
    setData(next);
    setSheetOpen(false);
    await saveData(next);
  };

  const onMark = () => (multi ? setSheetOpen(true) : setPickerOpen(true));
  const overflow = viewportH > 0 && contentH > viewportH;

  const sheetStages = stages.map((st, i) => {
    const p = getPart(data, st.partId);
    return {
      id: st.id,
      label: p ? (p.name || 'Untitled part') : `Stage ${i + 1}`,
      sub: `Every ${formatInterval(st.intervalDays)} · Next ${fmt(st.status.due)}`,
      status: st.status,
    };
  });

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

      <ScrollView
        onLayout={e => setViewportH(e.nativeEvent.layout.height)}
        onContentSizeChange={(w, h) => setContentH(h)}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: (overflow ? footerH : 0) + 40, paddingTop: 4 }}
      >
        <View style={s.bigChip}><TypeIcon type={f.type} size={52} color={t.iconInk} /></View>
        <Text style={s.title}>{f.name}</Text>
        {noStages ? (
          <View style={[s.pill, { backgroundColor: t.tabIdleBg, alignSelf: 'flex-start', marginTop: 8, marginLeft: 16 }]}>
            <Text style={[s.pillTxt, { color: t.inkSoft }]}>No parts</Text>
          </View>
        ) : (
          <View style={[s.pill, { backgroundColor: tone.pillBg, alignSelf: 'flex-start', marginTop: 8, marginLeft: 16 }]}>
            <Text style={[s.pillTxt, { color: tone.pillInk }]}>{status.label}</Text>
          </View>
        )}

        <View style={s.rows}>
          <Row t={t} k="Location" v={asset?.name || '—'} />
          <Row t={t} k="Type" v={FILTER_TYPES[f.type]?.label || 'Other'} last={noStages} />
          {noStages ? null : multi ? (
            <>
              <Row t={t} k="Stages" v={`${stages.length}`} />
              <Row t={t} k="Next due" v={fmt(status.due)} last />
            </>
          ) : (
            <>
              <Row t={t} k="Replace every" v={formatInterval(s0.intervalDays)} />
              <Row t={t} k="Last replaced" v={fmt(s0.lastReplaced)} />
              <Row t={t} k="Next due" v={fmt(status.due)} last />
            </>
          )}
        </View>

        {noStages ? (
          <>
            <View style={s.emptyParts}>
              <Text style={s.emptyPartsTxt}>
                No parts linked yet. Add one from Edit to track replacements, or
                use Notes to track this filter by hand.
              </Text>
            </View>
            {hasNotes && (
              <View style={s.notesRow}>
                <NotesAffordance />
              </View>
            )}
          </>
        ) : multi ? (
          <>
            <View style={s.partHeaderRow}>
              <Text style={s.partLabel}>STAGES</Text>
              {hasNotes && <NotesAffordance style={s.notesNudge} />}
            </View>
            {stages.map((st, i) => (
              <StageCard
                key={st.id}
                t={t} s={s} stage={st} index={i}
                part={getPart(data, st.partId)}
                fmt={fmt}
                onPress={(pid) => router.push(`/part/${pid}`)}
              />
            ))}
          </>
        ) : (
          <>
            {/* No part → Notes on its own line below the card. */}
            {hasNotes && !part && (
              <View style={s.notesRow}>
                <NotesAffordance />
              </View>
            )}
            {part && (
              <>
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
          </>
        )}

        {!noStages && !overflow && (
          <Pressable
            style={[s.markBtn, (!multi && hasNotes && !part) && s.markBtnNotesTop]}
            onPress={onMark}
          >
            <Text style={s.markBtnTxt}>✓ Mark Replaced</Text>
          </Pressable>
        )}
      </ScrollView>

      {!noStages && overflow && (
        <View
          style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
          onLayout={e => setFooterH(e.nativeEvent.layout.height)}
        >
          <Pressable style={[s.markBtn, s.markBtnPinned]} onPress={onMark}>
            <Text style={s.markBtnTxt}>✓ Mark Replaced</Text>
          </Pressable>
        </View>
      )}

      <DatePickerModal
        visible={pickerOpen}
        initialDate={new Date()}
        maximumDate={new Date()}
        title="Install Date"
        onCancel={() => setPickerOpen(false)}
        onConfirm={onConfirmDate}
      />

      <MarkReplacedSheet
        visible={sheetOpen}
        stages={sheetStages}
        onCancel={() => setSheetOpen(false)}
        onConfirm={onConfirmSheet}
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

// One stage in a multi-stage filter. Tappable when it has a linked part.
// Mirrors the single-stage PART card: a [content | chevron] row, with the
// Low-stock pill top-right (the headline status already lives at the page top,
// so a per-stage status pill here just adds noise).
function StageCard({ t, s, stage, index, part, fmt, onPress }) {
  const low = isPartLow(part);
  const title = part ? (part.name || 'Untitled part') : `Stage ${index + 1}`;

  const Body = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={s.stageTop}>
        <Text style={s.partName} numberOfLines={1}>{title}</Text>
        {low && <View style={s.lowPill}><Text style={s.lowPillTxt}>Low stock</Text></View>}
      </View>
      {part && !!part.sku && <Text style={s.partMeta}>SKU: {part.sku}</Text>}
      <Text style={s.stageSched}>Every {formatInterval(stage.intervalDays)} · Next {fmt(stage.status.due)}</Text>
      {part
        ? <Text style={s.stageStock}>On hand: {part.onHand}</Text>
        : <Text style={s.noPart}>No part linked</Text>}
    </View>
  );

  return part
    ? <Pressable style={s.stageCard} onPress={() => onPress(part.id)}>{Body}<Text style={s.chev}>›</Text></Pressable>
    : <View style={s.stageCard}>{Body}</View>;
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
    title: { ...t.type.screenTitle, color: t.ink, marginTop: 14, paddingLeft: 16 },

    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: t.radius.pill },
    pillTxt: { ...t.type.pill },

    rows: { marginTop: 22, backgroundColor: t.card, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: t.line },

    notesRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 16, marginTop: 14 },

    partHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8, paddingHorizontal: 16 },
    partLabel: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase' },

    notesNudge: { transform: [{ translateY: -16 }] },

    notesInner: { alignSelf: 'flex-end' },
    notesLinkTxt: { color: t.ink, fontSize: 14, fontWeight: '700' },
    notesChev: { position: 'absolute', left: '100%', marginLeft: 4, top: -1, color: t.muted, fontSize: 17, lineHeight: 18, fontWeight: '700' },

    partCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 14 },
    emptyParts: { backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 16, marginTop: 4 },
    emptyPartsTxt: { fontSize: 14, color: t.muted, lineHeight: 20 },
    partName: { fontSize: 15, fontWeight: '700', color: t.ink, flex: 1, minWidth: 0 },
    partMeta: { fontSize: 12, color: t.muted, marginTop: 3 },
    partStockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    partStock: { fontSize: 12.5, color: t.inkSoft, fontWeight: '600' },
    lowPill: { backgroundColor: t.status.amb.pillBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    lowPillTxt: { color: t.status.amb.pillInk, fontSize: 11, fontWeight: '700' },
    chev: { fontSize: 22, color: t.muted, marginLeft: 8 },

    // Multi-stage cards. Stacked with a small gap between them.
    stageCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 14, marginBottom: 10, marginHorizontal: 16 },
    stageTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    stageSched: { fontSize: 12.5, color: t.inkSoft, fontWeight: '600', marginTop: 6 },
    stageStock: { fontSize: 12.5, color: t.muted, fontWeight: '500', marginTop: 5 },
    noPart: { fontSize: 12.5, color: t.muted, fontStyle: 'italic', marginTop: 6 },

    markBtn: { marginTop: 22, marginHorizontal: 16, backgroundColor: t.tabIdleBg, padding: 14, borderRadius: t.radius.btn, alignItems: 'center' },
    markBtnNotesTop: { marginTop: 14 },
    markBtnPinned: { marginTop: 0 },
    markBtnTxt: { fontSize: 15, fontWeight: '700', color: t.ink },

    // Pinned footer bar (opaque so content scrolls behind it cleanly).
    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bg, paddingHorizontal: 18, paddingTop: 10 },
  });
}