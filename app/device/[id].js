// app/device/[id].js — Device Detail.
//
// SINGLE-STAGE devices render exactly as before: a data card (Location / Type /
// Replace every / Last replaced / Next due), one FILTER card, and a one-tap
// Mark Replaced that opens the date picker.
//
// MULTI-STAGE devices render a STAGES section instead: the data card carries
// Location / Type / Stages / Next due (soonest), then one card per stage —
// each with its own status pill, linked filter (SKU / on-hand / low-stock),
// its own interval + next-due + last-replaced, and tap-through to the filter.
// Mark Replaced opens the per-stage sheet (check what you swapped, pick a date).
//
// (Single-stage already shows Last replaced in the summary data card; multi-stage
// stages surface it per StageCard, so both layouts show it and match the Edit
// screen's per-filter last-replaced line.)
//
// Intervals display in human units (1y / 6m / 30d) via lib/interval.
//
// Notes (authored on Edit; affordance shown only when notes exist):
//   - single, NO filter: right-justified "Notes ›" on its own line below the card.
//   - single, HAS filter: "Notes ›" rides on the FILTER header row.
//   - multi: "Notes ›" rides on the STAGES header row.
// Tapping opens NotesModal (read-only, dimmed sheet, Copy pill).

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { DeviceIcon } from '../../theme/Icons';
import { BackButton, PillButton } from '../../components/HeaderBits';
import DatePickerModal from '../../components/DatePickerModal';
import MarkReplacedSheet from '../../components/MarkReplacedSheet';
import {
  loadData, saveData, statusOf, stagesWithStatus, markReplaced, getFilter, isFilterLow,
  deviceDisplayType,
} from '../../data/store';
import { formatInterval } from '../../lib/interval';
import { openManualFile } from '../../lib/manualFile';
import useFixScrollToTop from '../../lib/useFixScrollToTop';

export default function DeviceDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const scrollsToTop = useFixScrollToTop();
  const [data, setData] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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
  const f = data.devices.find(x => x.id === id);
  if (!f) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.head}><BackButton onPress={() => router.back()} /><View /></View>
        <Text style={{ color: t.ink, padding: 22 }}>Device not found.</Text>
      </SafeAreaView>
    );
  }

  const status = statusOf(f, data);         // headline = soonest-due stage
  const tone = t.status[status.key];
  const stages = stagesWithStatus(f, data); // each {…, status}, soonest first
  const multi = stages.length > 1;
  const noStages = stages.length === 0;     // no filters -> no schedule
  const s0 = stages[0] || null;

  const asset = data.assets.find(a => a.id === f.assetId);
  const filter = getFilter(data, s0 ? s0.filterId : null);   // single-stage filter
  const filterLow = isFilterLow(filter);
  const hasNotes = !!(f.notes && f.notes.trim());
  // For no-filters devices: read lastReplaced from the raw (possibly filterless) stage.
  const rawLastReplaced = (f.stages || [])[0]?.lastReplaced || null;
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Appliance details (device-level): model, serial, and the product/support
  // page + owner's manual links. Each shows only when filled; the section is
  // absent entirely when the appliance has none.
  const model = (f.model || '').trim();
  const serial = (f.serial || '').trim();
  const productUrl = (f.productUrl || '').trim();
  const manualUrl = (f.manualUrl || '').trim();
  const manualFile = f.manualFile || null;
  const hasManual = !!(manualUrl || manualFile);
  const hasDetails = !!(model || serial || productUrl || hasManual);

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
    const p = getFilter(data, st.filterId);
    return {
      id: st.id,
      label: p ? (p.name || 'Untitled filter') : `Stage ${i + 1}`,
      sub: `Every ${formatInterval(st.intervalDays)} · Next ${fmt(st.status.due)}`,
      status: st.status,
    };
  });


  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <View style={{ paddingLeft: t.isTablet ? 16 : 0 }}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={{ paddingRight: t.isTablet ? 16 : 0 }}>
          <PillButton label="Edit" onPress={() => router.push(`/device/edit/${f.id}`)} />
        </View>
      </View>

      <ScrollView
        scrollsToTop={scrollsToTop}
        onLayout={e => setViewportH(e.nativeEvent.layout.height)}
        onContentSizeChange={(w, h) => setContentH(h)}
        contentContainerStyle={{ paddingHorizontal: t.isTablet ? t.ui(32) : 18, paddingBottom: (overflow ? footerH : 0) + 40, paddingTop: 4 }}
      >
        <View style={s.bigChip}><DeviceIcon iconName={f.icon} displayType={deviceDisplayType(f, data)} size={t.ui(52)} color={t.iconInk} /></View>
        <Text style={s.title}>{f.name}</Text>
        {!noStages && (
          <View style={[s.pill, { backgroundColor: tone.pillBg, alignSelf: 'flex-start', marginTop: 8, marginLeft: 16 }]}>
            <Text style={[s.pillTxt, { color: tone.pillInk }]}>{status.label}</Text>
          </View>
        )}

        <View style={s.rows}>
          <Row t={t} k="Location" v={asset?.name || '—'} last={noStages && !rawLastReplaced} />
          {noStages ? (
            rawLastReplaced
              ? <Row t={t} k="Last replaced" v={fmt(rawLastReplaced)} last />
              : null
          ) : multi ? (
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

        {noStages ? null : multi ? (
          <>
            <View style={s.filterHeaderRow}>
              <Text style={s.filterLabel}>STAGES</Text>
            </View>
            {stages.map((st, i) => (
              <StageCard
                key={st.id}
                t={t} s={s} stage={st} index={i}
                filter={getFilter(data, st.filterId)}
                fmt={fmt}
                onPress={(pid) => router.push(`/filter/${pid}`)}
              />
            ))}
          </>
        ) : (
          <>
            {filter && (
              <>
                <View style={s.filterHeaderRow}>
                  <Text style={s.filterLabel}>FILTER</Text>
                </View>
                <Pressable style={s.filterCard} onPress={() => router.push(`/filter/${filter.id}`)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.filterName} numberOfLines={1}>{filter.name || 'Untitled filter'}</Text>
                    {!!filter.sku && <Text style={s.filterMeta}>SKU: {filter.sku}</Text>}
                    <View style={s.filterStockRow}>
                      <Text style={s.filterStock}>On hand: {filter.onHand}</Text>
                      {filterLow && (
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

        {hasDetails && (
          <>
            {!!model && (<>
              <Text style={s.detailLabel}>MODEL</Text>
              <Text style={s.detailValue}>{model}</Text>
            </>)}
            {!!serial && (<>
              <Text style={s.detailLabel}>SERIAL</Text>
              <Text style={s.detailValue}>{serial}</Text>
            </>)}
            {!!productUrl && (<>
              <Text style={s.detailLabel}>PRODUCT URL</Text>
              <LinkBox t={t} s={s} url={productUrl} />
            </>)}
            {hasManual && (<>
              <Text style={s.detailLabel}>OWNER'S MANUAL</Text>
              {!!manualUrl && <LinkBox t={t} s={s} url={manualUrl} />}
              {!!manualFile && (
                <Pressable onPress={() => openManualFile(manualFile)} style={[s.openLink, !!manualUrl && { marginTop: 8 }]}>
                  <Text style={s.openLinkTxt} numberOfLines={1}>{manualFile.name || "Owner's manual"}</Text>
                  <Text style={s.openLinkArrow}>↗</Text>
                </Pressable>
              )}
            </>)}
          </>
        )}

        {/* Notes — shown as a plain box at the bottom; edit via Edit Device. */}
        {hasNotes && (
          <View style={s.notesBox}>
            <Text style={s.notesBoxLabel}>NOTES</Text>
            <Text style={s.notesBoxTxt}>{f.notes}</Text>
          </View>
        )}

        {!overflow && (
          <Pressable style={s.markBtn} onPress={onMark}>
            <Text style={s.markBtnTxt}>✓ Mark Replaced</Text>
          </Pressable>
        )}
      </ScrollView>

      {overflow && (
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
    </SafeAreaView>
  );
}

// One stage in a multi-stage device. Tappable when it has a linked filter.
// Mirrors the single-stage FILTER card: a [content | chevron] row, with the
// Low-stock pill top-right (the headline status already lives at the page top,
// so a per-stage status pill here just adds noise).
function StageCard({ t, s, stage, index, filter, fmt, onPress }) {
  const low = isFilterLow(filter);
  const title = filter ? (filter.name || 'Untitled filter') : `Stage ${index + 1}`;

  const Body = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={s.stageTop}>
        <Text style={s.filterName} numberOfLines={1}>{title}</Text>
        {low && <View style={s.lowPill}><Text style={s.lowPillTxt}>Low stock</Text></View>}
      </View>
      {filter && !!filter.sku && <Text style={s.filterMeta}>SKU: {filter.sku}</Text>}
      <Text style={s.stageSched}>Every {formatInterval(stage.intervalDays)} · Next {fmt(stage.status.due)}</Text>
      {/* Last replaced — parallels the single-stage summary card and the Edit
          screen's per-filter line, so this stage's recorded date is visible
          here too. Sits between the schedule and on-hand lines. */}
      {filter && (
        <Text style={s.stageReplaced}>Last replaced: {stage.lastReplaced ? fmt(stage.lastReplaced) : '—'}</Text>
      )}
      {filter
        ? <Text style={s.stageStock}>On hand: {filter.onHand}</Text>
        : <Text style={s.noFilter}>No filter linked</Text>}
    </View>
  );

  return filter
    ? <Pressable style={s.stageCard} onPress={() => onPress(filter.id)}>{Body}<Text style={s.chev}>›</Text></Pressable>
    : <View style={s.stageCard}>{Body}</View>;
}

function Row({ t, k, v, last }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      <Text style={{ color: t.muted, fontSize: t.uit(14) }}>{k}</Text>
      <Text style={{ color: t.ink, fontSize: t.uit(14), fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

// A tappable row that opens a URL (product page / owner's manual). Normalizes a
// scheme-less paste (e.g. "example.com") to https so Linking can open it.
// A tappable shaded box showing the URL (truncated to fit) with an arrow,
// matching the Filter screen's Reorder URL. Normalizes a scheme-less paste so
// Linking can open it.
function LinkBox({ t, s, url }) {
  const open = () => {
    const u = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : 'https://' + url;
    Linking.openURL(u).catch(() => {});
  };
  return (
    <Pressable onPress={open} style={s.openLink}>
      <Text style={s.openLinkTxt} numberOfLines={1}>{url}</Text>
      <Text style={s.openLinkArrow}>↗</Text>
    </Pressable>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: t.isTablet ? t.ui(32) : 18, paddingTop: 8, paddingBottom: 6 },

    bigChip: { width: t.ui(76), height: t.ui(76), borderRadius: t.ui(18), backgroundColor: t.iconBg, borderWidth: 1.5, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginLeft: 16 },
    title: { ...t.type.screenTitle, color: t.ink, marginTop: 14, paddingLeft: 16 },

    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: t.radius.pill },
    pillTxt: { ...t.type.pill },

    rows: { marginTop: 22, backgroundColor: t.card, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: t.line },

    // Stacked detail fields (DETAILS section), matching the Filter screen.
    detailLabel: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 16 },
    detailValue: { fontSize: t.uit(15), fontWeight: '600', color: t.ink, paddingLeft: 16 },
    openLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 10, backgroundColor: t.tabIdleBg },
    openLinkTxt: { color: t.ink, fontSize: t.uit(14), flex: 1, marginRight: 8 },
    openLinkArrow: { color: t.inkSoft, fontSize: t.uit(18), fontWeight: '700' },

    notesRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 16, marginTop: 14 },

    filterHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8, paddingHorizontal: 16 },
    filterLabel: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase' },

    notesNudge: { transform: [{ translateY: -16 }] },

    notesInner: { alignSelf: 'flex-end' },
    notesLinkTxt: { color: t.ink, fontSize: t.uit(14), fontWeight: '700' },
    notesChev: { position: 'absolute', left: '100%', marginLeft: 4, top: -1, color: t.muted, fontSize: t.uit(17), lineHeight: 18, fontWeight: '700' },

    filterCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 14 },
    notesBox: { marginTop: 22, backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.line, padding: 14 },
    notesBoxLabel: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginBottom: 8 },
    notesBoxTxt: { fontSize: t.uit(14), color: t.ink, lineHeight: 20 },
    emptyFilters: { backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 16, marginTop: 4 },
    emptyFiltersTxt: { fontSize: t.uit(14), color: t.muted, lineHeight: 20 },
    filterName: { fontSize: t.uit(15), fontWeight: '700', color: t.ink, flex: 1, minWidth: 0 },
    filterMeta: { fontSize: t.uit(12), color: t.muted, marginTop: 3 },
    filterStockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    filterStock: { fontSize: t.uit(12.5), color: t.inkSoft, fontWeight: '600' },
    lowPill: { backgroundColor: t.status.amb.pillBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    lowPillTxt: { color: t.status.amb.pillInk, fontSize: t.uit(11), fontWeight: '700' },
    chev: { fontSize: t.uit(22), color: t.muted, marginLeft: 8 },

    // Multi-stage cards. Stacked with a small gap between them.
    stageCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 14, marginBottom: 10, marginHorizontal: 16 },
    stageTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    stageSched: { fontSize: t.uit(12.5), color: t.inkSoft, fontWeight: '600', marginTop: 6 },
    // Last-replaced line — muted, sits between schedule and on-hand.
    stageReplaced: { fontSize: t.uit(12.5), color: t.muted, fontWeight: '500', marginTop: 5 },
    stageStock: { fontSize: t.uit(12.5), color: t.muted, fontWeight: '500', marginTop: 5 },
    noFilter: { fontSize: t.uit(12.5), color: t.muted, fontStyle: 'italic', marginTop: 6 },

    markBtn: { marginTop: 22, marginHorizontal: 16, backgroundColor: t.tabIdleBg, padding: 14, borderRadius: t.radius.btn, alignItems: 'center' },
    markBtnNotesTop: { marginTop: 14 },
    markBtnPinned: { marginTop: 0 },
    markBtnTxt: { fontSize: t.uit(15), fontWeight: '700', color: t.ink },

    // Pinned footer bar (opaque so content scrolls behind it cleanly).
    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bg, paddingHorizontal: 18, paddingTop: 10 },
  });
}