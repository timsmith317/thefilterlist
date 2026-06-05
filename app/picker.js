// app/picker.js — Asset / Part selection, presented as a stacked modal route.
//
// Why a route instead of an overlay <Modal>: when "+ Add new part" pushes the
// New Part screen, we want New Part to slide up ON TOP of this picker and
// cover it, with the picker staying put underneath. As a modal ROUTE, New Part
// stacks natively on top; opening this picker is the native sheet slide.
//
// Two selection modes:
//   SINGLE (default) — tap a row to choose one value; resolves immediately to
//     the opener via lib/pendingPick { field:kind, value, stageId } and pops.
//     Used for assets and for a single stage's part (the StagesEditor flow).
//   MULTI (param multi='1', parts only) — tap rows to toggle a checkbox set,
//     seeded from `selectedIds`. Done returns the whole set as
//     { field:'parts', values:[...] }; Cancel pops with nothing pending.
//     Used by the Filter editor to pick the set of parts a filter contains.
//
// "+ Add new part" pushes New Part on top:
//   - single: New Part pops BOTH itself and this picker (dismiss 2), handing
//     the new part straight to the opener.
//   - multi: New Part pops back to THIS picker (pop 1) and hands the new id
//     back via { field:'addPart', value }, which we fold into the live
//     selection here so it lands pre-checked; Done then returns the set.
//
// Params (all strings, via the URL):
//   kind       - 'part' | 'asset'
//   multi      - '1' to enable multi-select (parts only)
//   selectedId - SINGLE: the currently selected id ('' = none)
//   selectedIds- MULTI: comma-separated currently selected ids
//   stageId    - (single part picks) the draft stage this pick is FOR
//   filterId   - (asset picks) the filter a newly created asset links to

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../theme/theme';
import { loadData, partsList } from '../data/store';
import { setPendingPick, consumePendingPick } from '../lib/pendingPick';

export default function Picker() {
  const t = useTheme();
  const router = useRouter();
  const { kind, multi, selectedId, selectedIds, filterId, stageId } = useLocalSearchParams();
  const isPart = kind === 'part';
  const isMulti = isPart && (multi === '1' || multi === 'true');

  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() =>
    new Set((selectedIds ? String(selectedIds).split(',') : []).filter(Boolean))
  );
  // Measure scroll viewport vs. content to decide whether the Add button
  // hugs the list (fits) or pins to the bottom (scrolls).
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const s = makeStyles(t);

  // Reload on focus so a just-created part shows up; in multi mode also fold a
  // newly-created part into the live selection.
  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => { if (active) setData(d); });
    if (isMulti) {
      const pick = consumePendingPick();
      if (pick && pick.field === 'addPart' && pick.value) {
        setSelected(prev => new Set(prev).add(pick.value));
      }
    }
    return () => { active = false; };
  }, [isMulti]));

  const items = useMemo(() => {
    if (!data) return [];
    return isPart ? partsList(data) : data.assets.filter(a => !a.archived);
  }, [data, isPart]);

  const searchKeys = isPart ? ['name', 'sku'] : ['name'];
  const title = isMulti ? 'Choose Parts' : (isPart ? 'Choose Part' : 'Choose Asset');
  const searchPlaceholder = isPart ? 'Search by name or SKU...' : 'Search assets...';
  const emptyText = isPart ? 'No parts yet.' : 'No assets yet.';

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
      searchKeys.some(key => {
        const val = item[key];
        return val && String(val).toLowerCase().includes(q);
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query]);

  const noMatches = query && filtered.length === 0;
  const showNoneRow = isPart && !isMulti && !query;
  const overflow = viewportH > 0 && contentH > viewportH;

  const showAdd = isPart ? true : !!filterId;
  const addLabel = isPart ? '+ Add new part' : '+ Add asset';
  const addPath = isPart ? '/part/new' : '/asset/new';

  // SINGLE: resolve one value to the opener and pop.
  const choose = (value) => {
    setPendingPick({ field: kind, value, stageId });
    router.back();
  };
  // MULTI: toggle membership locally; Done returns the set.
  const toggle = (id) =>
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const done = () => {
    setPendingPick({ field: 'parts', values: [...selected] });
    router.back();
  };

  // Push New Part/Asset ON TOP. In multi we pass multi so New Part returns to
  // THIS picker; otherwise it carries stageId/filterId for the single flow.
  const addNew = () => {
    router.push({ pathname: addPath, params: isMulti ? { multi: '1' } : { filterId, stageId } });
  };

  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <SafeAreaView style={s.sheet} edges={['bottom']}>
      <View style={s.header}>
        {isMulti ? (
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.leftTap}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
        ) : (
          <View style={{ width: 72 }} />
        )}
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {isMulti ? (
          <Pressable onPress={done} hitSlop={10} style={s.donePill}>
            <Text style={s.doneTxt}>Done</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.cancelTap}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
        )}
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={t.muted}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
          onLayout={e => setViewportH(e.nativeEvent.layout.height)}
          onContentSizeChange={(w, h) => setContentH(h)}
        >
          {showNoneRow && (
            <Pressable style={s.row} onPress={() => choose(null)}>
              <Text style={[s.rowName, !selectedId && s.rowNameOn]}>None (no part linked)</Text>
              {!selectedId && <Text style={s.check}>✓</Text>}
            </Pressable>
          )}

          {filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>{noMatches ? 'No matches' : emptyText}</Text>
            </View>
          )}

          {filtered.map(item => {
            const on = isMulti ? selected.has(item.id) : (item.id === selectedId);
            return (
              <Pressable
                key={item.id}
                style={s.row}
                onPress={() => (isMulti ? toggle(item.id) : choose(item.id))}
              >
                {isMulti && (
                  <View style={[s.box, on && s.boxOn]}>
                    {on && <Text style={s.boxCheck}>✓</Text>}
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.rowName, on && !isMulti && s.rowNameOn]} numberOfLines={1}>
                    {item.name || 'Untitled'}
                  </Text>
                  {!!item.sku && <Text style={s.rowSub} numberOfLines={1}>SKU: {item.sku}</Text>}
                </View>
                {on && !isMulti && <Text style={s.check}>✓</Text>}
              </Pressable>
            );
          })}

          {showAdd && !overflow && (
            <Pressable style={[s.addBtn, s.addBtnInline]} onPress={addNew}>
              <Text style={s.addBtnTxt}>{addLabel}</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {showAdd && overflow && (
        <View style={s.footer}>
          <Pressable style={s.addBtn} onPress={addNew}>
            <Text style={s.addBtnTxt}>{addLabel}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 22,
      paddingBottom: 16,
    },
    title: { fontSize: 16, fontWeight: '700', color: t.ink, flex: 1, textAlign: 'center' },
    leftTap: { width: 72, alignItems: 'flex-start' },
    cancelTap: { width: 72, alignItems: 'flex-end' },
    cancel: { color: t.inkSoft, fontSize: 15 },
    donePill: { width: 72, alignItems: 'center', backgroundColor: t.tabIdleBg, paddingVertical: 7, borderRadius: 999 },
    doneTxt: { color: t.ink, fontSize: 14, fontWeight: '700' },

    searchWrap: { paddingHorizontal: 16, paddingBottom: 14 },
    search: {
      backgroundColor: t.tabIdleBg,
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: 10,
      fontSize: 15,
      color: t.ink,
    },

    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 16 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: t.line,
    },
    rowName: { fontSize: 15, color: t.ink, flex: 1 },
    rowNameOn: { fontWeight: '700' },
    rowSub: { fontSize: 12, color: t.muted, marginTop: 2 },
    check: { fontSize: 18, color: t.ink, fontWeight: '700', marginLeft: 8 },

    // Multi-select checkbox (white box, soft border when checked, black check).
    box: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', marginRight: 12,
    },
    boxOn: { borderColor: '#B0B0B0' },
    boxCheck: { color: t.ink, fontSize: 13, fontWeight: '600', lineHeight: 15 },

    addBtn: {
      padding: 14,
      borderRadius: t.radius.btn,
      backgroundColor: t.tabIdleBg,
      alignItems: 'center',
    },
    addBtnInline: { marginTop: 14 },
    addBtnTxt: { fontSize: 15, fontWeight: '700', color: t.ink },

    footer: {
      backgroundColor: t.bg,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 8,
    },

    empty: { paddingVertical: 30, alignItems: 'center' },
    emptyTxt: { fontSize: 14, color: t.muted, fontStyle: 'italic' },
  });
}