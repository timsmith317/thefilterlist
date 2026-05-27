// app/index.js — Due Soon.
// Header: wordmark "The Filter List" CENTERED on the notch; logo sits to its
// LEFT without shifting the wordmark's center. Achieved by a centered row with
// the logo on one side and an equal-width spacer on the other.
// Filter cards: icon top-aligned with filter name; bigger glyph inside chip.

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';
import { LogoMark, TypeIcon, IconGear } from '../theme/Icons';
import Wordmark from '../theme/Wordmark';
import {
  loadData, saveData, dueSoonList, filtersForCategory, dueCount, markReplaced,
} from '../data/store';

const LOGO_SIZE = 42;
const LOGO_GAP = 10;

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

  const tabs = [{ id: 'All', name: 'All' }, ...data.categories.slice().sort((a, b) => a.order - b.order)];
  const list = tab === 'All' ? dueSoonList(data) : filtersForCategory(data, tab);
  const due = dueCount(list);

  const onReplace = async (id) => {
    const next = markReplaced(data, id);
    setData(next);
    await saveData(next);
  };

  const s = makeStyles(t);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Brand header: centered row with logo + wordmark + invisible spacer.
          The spacer matches the logo's width so the wordmark stays optically
          centered on the notch even though the logo is on its left. */}
      <View style={s.brandRow}>
        <View style={s.logoBox}><LogoMark size={22} color={t.ink} /></View>
        <Wordmark color={t.ink} size={26} />
        <View style={{ width: LOGO_SIZE + LOGO_GAP }} />
      </View>

      {/* Title row — Settings pill nudged down to align text baseline with "Due Soon" */}
      <View style={s.titleRow}>
        <Text style={s.title}>Due Soon</Text>
        <View style={s.settingsWrap}>
          <Pressable style={s.settings} onPress={() => router.push('/settings')} hitSlop={8}>
            <IconGear size={14} color={t.inkSoft} />
            <Text style={s.settingsTxt}>Settings</Text>
          </Pressable>
        </View>
      </View>
      <Text style={s.sub}>
        {due === 0 ? "Everything's fresh." : `${due} filter${due > 1 ? 's' : ''} need${due > 1 ? '' : 's'} attention`}
      </Text>

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
        {list.length === 0 && <Text style={s.empty}>No filters here yet.</Text>}
        {list.map(f => {
          const tone = t.status[f.status.key];
          return (
            <Pressable key={f.id} style={s.card} onPress={() => router.push(`/filter/${f.id}`)}>
              <View style={s.iconChip}><TypeIcon type={f.type} size={26} color={t.iconInk} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardName} numberOfLines={1}>{f.name}</Text>
                <Text style={s.cardMeta}>{f.asset?.name} · every {f.intervalDays}d</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[s.pill, { backgroundColor: tone.pillBg }]}>
                  <Text style={[s.pillTxt, { color: tone.pillInk }]}>{f.status.label}</Text>
                </View>
                <Pressable onPress={() => onReplace(f.id)} hitSlop={8}>
                  <Text style={s.action}>✓ Replaced</Text>
                </Pressable>
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
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: LOGO_GAP, paddingTop: t.space.lg, paddingBottom: t.space.sm, paddingHorizontal: t.space.lg },
    logoBox: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: t.radius.chip, backgroundColor: t.bg, borderWidth: 1.5, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center' },

    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.space.xl, paddingTop: t.space.lg, paddingBottom: 2 },
    title: { fontSize: 20, fontWeight: '700', color: t.ink, letterSpacing: 0.2 },
    // settingsWrap nudges the pill down so its text baseline aligns with the
    // bottom of "Due Soon" rather than the pill's bottom edge.
    settingsWrap: { paddingTop: 5 },
    settings: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, backgroundColor: t.tabIdleBg },
    settingsTxt: { fontSize: 12.5, fontWeight: '600', color: t.inkSoft },
    sub: { fontSize: 13, color: t.muted, paddingHorizontal: t.space.xl, paddingBottom: 4 },

    tabsWrap: { flexGrow: 0 },
    tabs: { paddingHorizontal: t.space.xl, paddingVertical: t.space.sm, gap: t.space.sm },
    tab: { paddingHorizontal: t.space.lg, paddingVertical: 7, borderRadius: t.radius.md, backgroundColor: t.tabIdleBg, marginRight: t.space.sm },
    tabOn: { backgroundColor: t.tabActiveBg },
    tabTxt: { fontSize: 13, fontWeight: '600', color: t.tabIdleInk },
    tabTxtOn: { color: t.tabActiveInk },

    list: { flex: 1 },
    listContent: { paddingHorizontal: t.space.lg, paddingTop: t.space.md, gap: 11 },
    empty: { padding: 24, textAlign: 'center', color: t.muted, fontStyle: 'italic' },

    // alignItems: 'flex-start' so the icon chip aligns with the top of the
    // filter name rather than centering on the whole card's content.
    card: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 14, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: t.radius.card },
    iconChip: { width: 42, height: 42, borderRadius: t.radius.chip, backgroundColor: t.iconBg, borderWidth: 1.5, borderColor: t.iconBorder, alignItems: 'center', justifyContent: 'center' },

    cardName: { ...t.type.body, color: t.ink },
    cardMeta: { ...t.type.meta, color: t.muted, marginTop: 2 },
    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: t.radius.pill },
    pillTxt: { ...t.type.pill },
    action: { fontSize: 12, fontWeight: '600', color: t.inkSoft, marginTop: 7 },
  });
}
