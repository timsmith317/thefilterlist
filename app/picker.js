// app/picker.js — Asset / Part selection, presented as a stacked modal route.
//
// Why a route instead of an overlay <Modal>: when "+ Add new part" pushes the
// New Part screen, we want New Part to slide up ON TOP of this picker and
// cover it, with the picker staying put underneath — no visible "roll to the
// bottom." An overlay Modal lives above the navigation stack, so the only way
// New Part could become visible was for the picker to dismiss first (the
// roll-away we were trying to get rid of). As a modal ROUTE, New Part stacks
// natively on top of it instead, and opening this picker is the native sheet
// slide again (no custom dim flash).
//
// Params (all strings, via the URL):
//   kind       - 'part' | 'asset'
//   selectedId - currently selected id ('' / undefined means none)
//   filterId   - the filter to link a newly created item to. Passed through
//                to New Part / New Asset so the new item links to the filter
//                and is auto-selected on return.
//
// Selection is handed back to the opener via lib/pendingPick, then we pop.
// Tapping a row, "None", or creating a new part all resolve through there;
// Cancel / swipe-down just pops with nothing pending (opener keeps its value).
//
// Layout matches the old PickerSheet: header (title + Cancel) / search /
// scrollable list (optional "None" at top). For parts, the "+ Add new part"
// button hugs the list when everything fits and pins to the bottom once the
// list scrolls.

import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../theme/theme';
import { loadData, partsList } from '../data/store';
import { setPendingPick } from '../lib/pendingPick';

export default function Picker() {
  const t = useTheme();
  const router = useRouter();
  const { kind, selectedId, filterId } = useLocalSearchParams();
  const isPart = kind === 'part';

  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  // Measure scroll viewport vs. content to decide whether the Add button
  // hugs the list (fits) or pins to the bottom (scrolls).
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const s = makeStyles(t);

  useEffect(() => { loadData().then(setData); }, []);

  const items = useMemo(() => {
    if (!data) return [];
    return isPart ? partsList(data) : data.assets.filter(a => !a.archived);
  }, [data, isPart]);

  const searchKeys = isPart ? ['name', 'sku'] : ['name'];
  const title = isPart ? 'Choose Part' : 'Choose Asset';
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
  const showNoneRow = isPart && !query;
  const overflow = viewportH > 0 && contentH > viewportH;

  // The Add button shows when we have a filter to link the new item to
  // (Edit Filter always passes filterId). Part → New Part, asset → New Asset.
  const showAdd = !!filterId;
  const addLabel = isPart ? '+ Add new part' : '+ Add asset';
  const addPath = isPart ? '/part/new' : '/asset/new';

  // Resolve the selection back to the opener, then pop this screen.
  const choose = (value) => {
    setPendingPick({ field: kind, value });
    router.back();
  };

  // Push the New Part/Asset screen ON TOP of this picker (it covers; nothing
  // rolls away). On save it pops itself AND this picker back to Edit Filter.
  const addNew = () => {
    router.push({ pathname: addPath, params: { filterId } });
  };

  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <SafeAreaView style={s.sheet} edges={['bottom']}>
      <View style={s.header}>
        <View style={{ width: 64 }} />
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.cancelTap}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
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
            const on = item.id === selectedId;
            return (
              <Pressable key={item.id} style={s.row} onPress={() => choose(item.id)}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.rowName, on && s.rowNameOn]} numberOfLines={1}>
                    {item.name || 'Untitled'}
                  </Text>
                  {!!item.sku && <Text style={s.rowSub} numberOfLines={1}>SKU: {item.sku}</Text>}
                </View>
                {on && <Text style={s.check}>✓</Text>}
              </Pressable>
            );
          })}

          {/* Inline Add button — hugs the list when everything fits. */}
          {showAdd && !overflow && (
            <Pressable style={[s.addBtn, s.addBtnInline]} onPress={addNew}>
              <Text style={s.addBtnTxt}>{addLabel}</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pinned Add button — drops to the bottom, list scrolls behind it,
          once the content is taller than the viewport. */}
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
    cancelTap: { width: 64, alignItems: 'flex-end' },
    cancel: { color: t.inkSoft, fontSize: 15 },

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