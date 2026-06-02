// components/PickerSheet.js
//
// Modal sheet picker for choosing one item from a (possibly large) list.
// Used for both Asset and Part selection on Edit Filter.
//
// Props:
//   visible       - bool, controls modal visibility
//   title         - string, sheet title (e.g. "Choose Asset")
//   items         - array of { id, name, sku? } objects
//   selectedId    - currently selected id (null/undefined for None)
//   searchKeys    - array of object keys to search (default ['name'])
//   onSelect      - (id) => void, called when user taps an item
//   onCancel      - () => void, called when user dismisses
//   onSelectNone  - optional () => void; if provided, shows a "None" row
//   noneLabel     - string label for the None row (default "None")
//   onAddNew      - optional () => void; if provided, shows "+ Add new" row
//   addNewLabel   - string label for add row (default "+ Add new")
//   emptyText     - shown when items list is empty
//
// Layout:
//   Uses presentationStyle="pageSheet" for native iOS sheet behavior.
//   Sheet contains: handle / header (title + Cancel) / search input /
//   scrollable list (with optional "Add new" and "None" rows at top).

import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';

export default function PickerSheet({
  visible,
  title,
  items = [],
  selectedId,
  searchKeys = ['name'],
  onSelect,
  onCancel,
  onSelectNone,
  noneLabel = 'None',
  onAddNew,
  addNewLabel = '+ Add new',
  emptyText = 'No items yet.',
  searchPlaceholder = 'Search...',
}) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const s = makeStyles(t);

  // Reset search when sheet closes so it starts fresh next time
  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  // Filter items by query across the configured search keys.
  // Empty query returns the full list. Match is case-insensitive substring.
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
      searchKeys.some(key => {
        const val = item[key];
        return val && String(val).toLowerCase().includes(q);
      })
    );
  }, [items, query, searchKeys]);

  const noMatches = query && filtered.length === 0;
  const showNoneRow = !!onSelectNone && !query; // hide None when searching

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={s.sheet} edges={['bottom']}>
        <View style={s.header}>
          <View style={{ width: 64 }} />
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <Pressable onPress={onCancel} hitSlop={10} style={s.cancelTap}>
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
          >
            {/* "Add new" row, shown when caller provides onAddNew */}
            {onAddNew && (
              <Pressable style={s.row} onPress={onAddNew}>
                <Text style={s.addNewTxt}>{addNewLabel}</Text>
              </Pressable>
            )}

            {/* "None" row, shown when caller provides onSelectNone and not searching */}
            {showNoneRow && (
              <Pressable style={s.row} onPress={onSelectNone}>
                <Text style={[s.rowName, !selectedId && s.rowNameOn]}>
                  {noneLabel}
                </Text>
                {!selectedId && <Text style={s.check}>✓</Text>}
              </Pressable>
            )}

            {/* Empty / no-match states */}
            {filtered.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyTxt}>{noMatches ? 'No matches' : emptyText}</Text>
              </View>
            )}

            {/* Item rows */}
            {filtered.map(item => {
              const on = item.id === selectedId;
              return (
                <Pressable
                  key={item.id}
                  style={s.row}
                  onPress={() => onSelect(item.id)}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.rowName, on && s.rowNameOn]} numberOfLines={1}>
                      {item.name || 'Untitled'}
                    </Text>
                    {!!item.sku && (
                      <Text style={s.rowSub} numberOfLines={1}>SKU: {item.sku}</Text>
                    )}
                  </View>
                  {on && <Text style={s.check}>✓</Text>}
                </Pressable>
              );
            })}

            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
    listContent: { paddingHorizontal: 16, paddingBottom: 20 },

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

    addNewTxt: { fontSize: 15, fontWeight: '700', color: t.ink },

    empty: { paddingVertical: 30, alignItems: 'center' },
    emptyTxt: { fontSize: 14, color: t.muted, fontStyle: 'italic' },
  });
}