// File: app/index.js → ~/Projects/thefilterlist/app/index.js
//
// app/index.js — Due Soon (home screen).
//
// Config constants (tweak these):
//   LOCKUP_NUDGE: horizontal nudge (px) for the brand lockup (logo +
//     wordmark) to keep it optically centered.
//   WORDMARK_COLOR: color of "The Filter List" text. Leave null to use the
//     theme's text color, which adapts to light AND dark mode (recommended).
//     A fixed hex (e.g. '#0f172a') reads great in one mode but can vanish in
//     the other, so only hardcode if you don't support both appearances.
//   PILL_NUDGE: vertical nudge (px) for the status pill on each card. It's the
//     marginTop on the pill: 0 sits it at the top of the title row, NEGATIVE
//     moves it UP, positive moves it down. Tune to taste.
//
const LOCKUP_NUDGE = -8;
const WORDMARK_COLOR = null;      // null = theme text color (adapts light/dark)
const WORDMARK_SIZE = 18;        // brand wordmark size — small = masthead, lets "Due Soon" lead
const PILL_NUDGE = -4;            // status-pill vertical nudge; negative = up
// Header app icon + its framing ring. LOGO_SIZE is the icon size; the
// border constants control the light ring around it. Set WIDTH to 0 to
// remove the ring. COLOR null falls back to the theme's light border.
const LOGO_SIZE         = 32;
// The header app icon looked slightly oversized on iPad at the full ui() (1.2)
// bump. LOGO_TABLET_SCALE gives it its own gentler multiplier so it sits right
// in the brand lockup. 1.0 = keep iPhone size on iPad; 1.1 = slight bump.
// Tune to taste; applied only on tablet (iPhone always uses LOGO_SIZE as-is).
const LOGO_TABLET_SCALE = 1.05;
const LOGO_BORDER_COLOR = '#14532D';   // e.g. '#d7dce1'; null = theme iconBorder
const LOGO_BORDER_WIDTH = 0;      // ring thickness in px (0 = no ring)
const LOGO_BORDER_GAP   = 1;      // gap between the ring and the icon (px)
// Card internal padding — the inset from the card edge to its inner
// content (icon left, pill right). Title row, sub-text, and tabs row
// all align to (body padding + CARD_PADDING) so that "Due Soon", the
// Settings pill, and the All/Home/Auto/Work pills sit on the same
// vertical lines as the icon-left and status-pill-right of each card.
// Change CARD_PADDING in one place and everything tracks.
const CARD_PADDING = 14;
// iPad: cards lay out in a responsive grid instead of one wide column.
// TABLET_COLUMNS is the column count on iPad (iPhone always = 1). 2 is the
// natural fit for these cards; tune if you later want 3 on a large iPad.
const TABLET_COLUMNS = 2;
// =================================================================
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';
import { DeviceIcon, IconGear } from '../theme/Icons';
import BrandMark from '../components/BrandMark';
import Wordmark from '../theme/Wordmark';
import {
  loadData, dueSoonList, devicesForAssetId, assetsList, dueCount,
} from '../data/store';
import { formatInterval } from '../lib/interval';
import useFixScrollToTop from '../lib/useFixScrollToTop';
import { syncNow } from '../lib/syncClient';


export default function DueSoon() {
  const t = useTheme();
  const scrollsToTop = useFixScrollToTop();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, []));

  // Pull to refresh. This is the gesture people reach for when they want to
  // know whether another device has changed something — the automatic triggers
  // (app opens, and a few seconds after a local edit) can't fire while you're
  // just sitting on this screen watching it.
  //
  // It reloads local data whether or not sync is on or succeeds: syncNow()
  // resolves with a result object instead of throwing, so a disabled or
  // unreachable sync simply means the refresh re-reads what's already here.
  // The gesture must never appear broken because the network is.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await syncNow(); } catch (_) { /* never surfaced here */ }
    try {
      const d = await loadData();
      setData(d);
    } catch (_) { /* keep showing what we have */ }
    setRefreshing(false);
  }, []);

  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const tabs = [{ id: 'All', name: 'All' }, ...assetsList(data).map(a => ({ id: a.id, name: a.name }))];
  const list = tab === 'All' ? dueSoonList(data) : devicesForAssetId(data, tab);
  const due = dueCount(list);
  const s = makeStyles(t);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={[s.brandRow, { transform: [{ translateX: LOCKUP_NUDGE }] }]}>
        <View style={s.logoBorder}><BrandMark size={t.isTablet ? Math.round(LOGO_SIZE * LOGO_TABLET_SCALE) : LOGO_SIZE} /></View>
        <Wordmark color={WORDMARK_COLOR || t.ink} size={t.uit(WORDMARK_SIZE)} />
      </View>
      <View style={s.titleRow}>
        <Text style={s.title}>Due Soon</Text>
        <View style={s.settingsWrap}>
          <Pressable style={s.settings} onPress={() => router.push('/settings')} hitSlop={8}>
            <IconGear size={t.ui(16)} color={t.ink} />
            <Text style={s.settingsTxt}>Settings</Text>
          </Pressable>
        </View>
      </View>
      <Text style={s.sub}>
        {due === 0 ? "Everything's fresh." : `${due} device${due > 1 ? 's' : ''} need${due > 1 ? '' : 's'} attention`}
      </Text>
      {/* Tabs use space-between with flexGrow: 1 so the "All" pill sits at
          the left inset and the last category pill sits at the right
          inset (matching the icon and status-pill alignment lines of
          the cards below). Still a horizontal ScrollView so that if
          enough categories are added to overflow, the row scrolls. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap} contentContainerStyle={[s.tabs, t.isTablet && s.tabsTablet]}>
        {tabs.map(tb => {
          const on = tab === tb.id;
          return (
            <Pressable key={tb.id} onPress={() => setTab(tb.id)} style={[s.tab, on && s.tabOn]}>
              <Text style={[s.tabTxt, on && s.tabTxtOn]}>{tb.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView
        scrollsToTop={scrollsToTop}
        style={s.list}
        contentContainerStyle={[s.listContent, t.isTablet && s.listContentTablet]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.muted} />
        }
      >
        {list.length === 0 && <Text style={s.empty}>No devices here yet.</Text>}
        {list.map(f => {
          const tone = t.status[f.status.key];
          const multi = f.status.stageCount > 1;
          const noFilters = f.status.stageCount === 0;
          return (
            <Pressable key={f.id} style={[s.card, t.isTablet && s.cardTablet]} onPress={() => router.push(`/device/${f.id}`)}>
              {/* Icon chip top-aligned with the title (alignItems: flex-start on
                  the card), so single- and multi-line cards both look aligned. */}
              <View style={s.iconChip}><DeviceIcon iconName={f.icon} displayType={f.displayType} size={t.ui(32)} color={t.iconInk} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                {/* Title + status pill share the top line. The title stays a
                    single line and truncates (we'd rather clip than wrap and
                    grow the card). The pill is top-aligned and nudged by
                    PILL_NUDGE. */}
                <View style={s.topRow}>
                  <Text style={s.cardName} numberOfLines={1}>{f.name}</Text>
                  {!noFilters && (
                    <View style={[s.pill, { backgroundColor: tone.pillBg, marginTop: PILL_NUDGE }]}>
                      <Text style={[s.pillTxt, { color: tone.pillInk }]}>{f.status.label}</Text>
                    </View>
                  )}
                </View>
                {/* Meta line, full width. For multi-stage the "N stages" badge
                    sits at the RIGHT END of this same line — so it lands under
                    the status pill, right-justified, WITHOUT adding any card
                    height. The meta text truncates behind the badge if long. */}
                <View style={s.metaRow}>
                  <Text style={s.cardMeta} numberOfLines={1}>
                    {f.asset?.name}{noFilters ? '' : multi ? ' · varies' : ` · every ${formatInterval(f.intervalDays)}`}
                  </Text>
                  {multi && (
                    <View style={s.stagesBadge}>
                      <Text style={s.stagesBadgeTxt}>{f.status.stageCount} stages</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  // Inset from the screen edge to the card's INNER content (icon left /
  // status pill right). Used to align the title row, sub-text, and tabs
  // row with the card content below.
  const CONTENT_INSET = t.space.lg + CARD_PADDING; // 16 + 14 = 30
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: t.space.lg, paddingBottom: t.space.sm, paddingHorizontal: t.space.lg },
    // Ring around the header app icon. Tune via the LOGO_BORDER_* constants
    // at the top of the file; borderRadius is derived to stay concentric
    // with the icon's own corners (icon radius = LOGO_SIZE * 0.225).
    logoBorder: {
      padding: LOGO_BORDER_GAP,
      borderWidth: LOGO_BORDER_WIDTH,
      borderColor: LOGO_BORDER_COLOR || t.iconBorder,
      borderRadius: LOGO_SIZE * 0.225 + LOGO_BORDER_GAP + LOGO_BORDER_WIDTH,
    },
    // Aligned to CONTENT_INSET on both sides so "Due Soon" sits over the
    // icon-left line and the Settings pill's right edge sits over the
    // status-pill-right line.
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: CONTENT_INSET, paddingTop: t.space.lg, paddingBottom: 2 },
    // Canonical screen title — 26/800/0.5. Matches every other screen.
    title: { ...t.type.screenTitle, color: t.ink },
    settingsWrap: { paddingTop: 5 },
    settings: { flexDirection: 'row', alignItems: 'center', gap: t.ui(7), paddingHorizontal: t.ui(14), paddingVertical: t.ui(7), borderRadius: 999, backgroundColor: t.tabIdleBg },
    // Bold + full black to match the app's pill labels (Edit, Save, Done, etc.).
    settingsTxt: { fontSize: t.uit(14), fontWeight: '700', color: t.ink },
    sub: { fontSize: t.uit(13), color: t.muted, paddingHorizontal: CONTENT_INSET, paddingBottom: 4 },
    tabsWrap: { flexGrow: 0 },
    // flexGrow: 1 stretches the content container to at least the
    // ScrollView width, so justifyContent: 'space-between' actually
    // spreads the few pills across the row. gap is the minimum spacing
    // for the overflow case (many categories scrolling).
    // paddingTop (20) is larger than paddingBottom (t.space.sm = 8) to
    // give the tabs row breathing room from the "N devices need
    // attention" sub text above.
    tabs: {
      flexGrow: 1,
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: CONTENT_INSET,
      paddingTop: 20,
      paddingBottom: t.space.sm,
      gap: t.space.sm,
    },
    // iPad: don't stretch pills across the full width. flexGrow:0 lets the row
    // size to its content, and a larger gap gives comfortable fixed spacing so
    // the pills cluster at the left inset instead of drifting to the far edges.
    tabsTablet: {
      flexGrow: 0,
      justifyContent: 'flex-start',
      gap: t.ui(12),
    },
    tab: { paddingHorizontal: t.space.lg, paddingVertical: t.ui(7), borderRadius: t.radius.md, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line },
    tabOn: { backgroundColor: t.tabIdleBg },
    tabTxt: { fontSize: t.uit(13), fontWeight: '600', color: t.inkSoft },
    tabTxtOn: { color: t.ink, fontWeight: '700' },
    list: { flex: 1 },
    listContent: { paddingHorizontal: t.space.lg, paddingTop: t.space.md, gap: 11 },
    // iPad grid: wrap cards into rows. flexDirection row + wrap, with a gap
    // between cards (both directions). Each card carries an explicit width
    // (cardTablet) so exactly TABLET_COLUMNS fit per row.
    listContentTablet: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.ui(12),
    },
    empty: { padding: 24, textAlign: 'center', color: t.muted, fontStyle: 'italic' },
    // alignItems: flex-start so the icon chip and the title/pill row both align
    // to the TOP of the card. padding uses CARD_PADDING so the title/sub/tabs
    // alignment math above stays in sync if this ever changes.
    card: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: CARD_PADDING, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: t.radius.card },
    // iPad card width: two columns that account for the inter-card gap.
    // With flexWrap + a row `gap`, two 50% cards would overflow (50%+50%+gap
    // > 100%). Using flexBasis with a calc-style subtraction isn't available in
    // RN, so we express width as a percentage slightly under the even split and
    // let the row gap provide the separation. For 2 columns: 48% each leaves
    // room for the gap between them and a hair of tolerance. Percentage keeps it
    // fluid across portrait/landscape rotation.
    cardTablet: {
      width: TABLET_COLUMNS === 2 ? '48.5%' : `${Math.floor(100 / TABLET_COLUMNS) - 2}%`,
    },
    iconChip: { width: t.ui(44), height: t.ui(44), borderRadius: t.radius.chip, backgroundColor: t.iconBg, borderWidth: 1.5, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center' },
    // Title + status pill on one row, top-aligned. Title takes the remaining
    // width and truncates; pill hugs the right edge.
    topRow: { flexDirection: 'row', alignItems: 'flex-start' },
    cardName: { ...t.type.body, color: t.ink, flex: 1, marginRight: 10 },
    // Meta line: asset (+ interval for single-stage) takes the row and
    // truncates; the "N stages" badge, when present, is pinned to the right
    // edge so it sits directly under the status pill.
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    cardMeta: { ...t.type.meta, color: t.muted, flex: 1, marginRight: 8 },
    stagesBadge: { backgroundColor: t.tabIdleBg, paddingHorizontal: t.ui(8), paddingVertical: t.ui(2), borderRadius: t.radius.pill },
    stagesBadgeTxt: { fontSize: t.uit(11), fontWeight: '700', color: t.inkSoft },
    pill: { paddingHorizontal: t.ui(9), paddingVertical: t.ui(4), borderRadius: t.radius.pill },
    pillTxt: { ...t.type.pill },
  });
}