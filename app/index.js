// app/index.js — Due Soon (home screen).
//
// Config constants (tweak these):
//   LOCKUP_NUDGE: horizontal nudge (px) for the brand lockup (logo +
//     wordmark) to keep it optically centered.
//   WORDMARK_COLOR: the color of "The Filter List" text.
//     Forest green '#15803d' to match logo, near-black '#0f172a' for neutral,
//     or sage greens like '#7c9885' for softer tone.
//   PILL_NUDGE: vertical nudge (px) for the status pill on each card. It's the
//     marginTop on the pill: 0 sits it at the top of the title row, NEGATIVE
//     moves it UP, positive moves it down. Tune to taste.
//
const LOCKUP_NUDGE = -8;
const WORDMARK_COLOR = '#15803d'; // soft sage green
const PILL_NUDGE = -4;            // status-pill vertical nudge; negative = up

// Card internal padding — the inset from the card edge to its inner
// content (icon left, pill right). Title row, sub-text, and tabs row
// all align to (body padding + CARD_PADDING) so that "Due Soon", the
// Settings pill, and the All/Home/Auto/Work pills sit on the same
// vertical lines as the icon-left and status-pill-right of each card.
// Change CARD_PADDING in one place and everything tracks.
const CARD_PADDING = 14;
// =================================================================

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';
import { LogoMark, DeviceIcon, IconGear } from '../theme/Icons';
import Wordmark from '../theme/Wordmark';
import {
  loadData, dueSoonList, devicesForAssetId, assetsList, dueCount,
} from '../data/store';
import { formatInterval } from '../lib/interval';

const LOGO_SIZE = 50;

export default function DueSoon() {
  const t = useTheme();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('All');

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, []));

  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const tabs = [{ id: 'All', name: 'All' }, ...assetsList(data).map(a => ({ id: a.id, name: a.name }))];
  const list = tab === 'All' ? dueSoonList(data) : devicesForAssetId(data, tab);
  const due = dueCount(list);
  const s = makeStyles(t);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={[s.brandRow, { transform: [{ translateX: LOCKUP_NUDGE }] }]}>
        <View style={s.logoBox}><LogoMark size={44} color={t.ink} /></View>
        <Wordmark color={WORDMARK_COLOR} size={26} />
      </View>

      <View style={s.titleRow}>
        <Text style={s.title}>Due Soon</Text>
        <View style={s.settingsWrap}>
          <Pressable style={s.settings} onPress={() => router.push('/settings')} hitSlop={8}>
            <IconGear size={16} color={t.ink} />
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap} contentContainerStyle={s.tabs}>
        {tabs.map(tb => {
          const on = tab === tb.id;
          return (
            <Pressable key={tb.id} onPress={() => setTab(tb.id)} style={[s.tab, on && s.tabOn]}>
              <Text style={[s.tabTxt, on && s.tabTxtOn]}>{tb.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={s.list} contentContainerStyle={s.listContent}>
        {list.length === 0 && <Text style={s.empty}>No devices here yet.</Text>}
        {list.map(f => {
          const tone = t.status[f.status.key];
          const multi = f.status.stageCount > 1;
          const noFilters = f.status.stageCount === 0;
          return (
            <Pressable key={f.id} style={s.card} onPress={() => router.push(`/device/${f.id}`)}>
              {/* Icon chip top-aligned with the title (alignItems: flex-start on
                  the card), so single- and multi-line cards both look aligned. */}
              <View style={s.iconChip}><DeviceIcon iconName={f.icon} displayType={f.displayType} size={32} color={t.iconInk} /></View>
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
    logoBox: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: t.radius.chip, backgroundColor: t.bg, borderWidth: 2, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center' },

    // Aligned to CONTENT_INSET on both sides so "Due Soon" sits over the
    // icon-left line and the Settings pill's right edge sits over the
    // status-pill-right line.
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: CONTENT_INSET, paddingTop: t.space.lg, paddingBottom: 2 },
    // Canonical screen title — 26/800/0.5. Matches every other screen.
    title: { ...t.type.screenTitle, color: t.ink },
    settingsWrap: { paddingTop: 5 },
    settings: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: t.tabIdleBg },
    // Bold + full black to match the app's pill labels (Edit, Save, Done, etc.).
    settingsTxt: { fontSize: 14, fontWeight: '700', color: t.ink },
    sub: { fontSize: 13, color: t.muted, paddingHorizontal: CONTENT_INSET, paddingBottom: 4 },

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
    tab: { paddingHorizontal: t.space.lg, paddingVertical: 7, borderRadius: t.radius.md, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.line },
    tabOn: { backgroundColor: t.tabIdleBg },
    tabTxt: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    tabTxtOn: { color: t.ink, fontWeight: '700' },

    list: { flex: 1 },
    listContent: { paddingHorizontal: t.space.lg, paddingTop: t.space.md, gap: 11 },
    empty: { padding: 24, textAlign: 'center', color: t.muted, fontStyle: 'italic' },

    // alignItems: flex-start so the icon chip and the title/pill row both align
    // to the TOP of the card. padding uses CARD_PADDING so the title/sub/tabs
    // alignment math above stays in sync if this ever changes.
    card: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: CARD_PADDING, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: t.radius.card },
    iconChip: { width: 44, height: 44, borderRadius: t.radius.chip, backgroundColor: t.iconBg, borderWidth: 1.5, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center' },

    // Title + status pill on one row, top-aligned. Title takes the remaining
    // width and truncates; pill hugs the right edge.
    topRow: { flexDirection: 'row', alignItems: 'flex-start' },
    cardName: { ...t.type.body, color: t.ink, flex: 1, marginRight: 10 },

    // Meta line: asset (+ interval for single-stage) takes the row and
    // truncates; the "N stages" badge, when present, is pinned to the right
    // edge so it sits directly under the status pill.
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    cardMeta: { ...t.type.meta, color: t.muted, flex: 1, marginRight: 8 },
    stagesBadge: { backgroundColor: t.tabIdleBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    stagesBadgeTxt: { fontSize: 11, fontWeight: '700', color: t.inkSoft },

    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: t.radius.pill },
    pillTxt: { ...t.type.pill },
  });
}