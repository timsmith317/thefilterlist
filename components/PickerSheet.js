// components/PickerSheet.js
//
// Modal sheet picker for choosing one item from a (possibly large) list.
// Used for both Asset and Filter selection on Edit Device.
//
// Animation: this is a self-animated sheet (transparent Modal +
// animationType="none" + a manual translateY slide), NOT the native iOS
// pageSheet. That's deliberate: it lets us control the close per-action.
//   - open / cancel / select  → slide down/up as usual
//   - tapping the Add button   → close INSTANTLY (no slide), so the New
//     screen pushed afterward simply covers the previous one instead of the
//     picker visibly sliding away first.
// The Modal stays mounted until any close animation finishes (internalVisible),
// the same pattern used by DatePickerModal.
//
// Props:
//   visible, title, items [{id,name,sku?}], selectedId, searchKeys,
//   onSelect(id), onCancel(), onSelectNone(), noneLabel,
//   onAddNew(), addNewLabel, emptyText, searchPlaceholder
//
// The Add button sits at the BOTTOM: it hugs the list when everything fits,
// and drops to a pinned footer (list scrolls behind it) once the list is
// long enough to scroll. Items render in the order passed in (caller sorts).

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet,
  Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';

// Slide distance must exceed any sheet height so the sheet starts/ends fully
// off the bottom of the screen. Durations tuned to feel like a system sheet.
const SLIDE_DISTANCE = 1000;
const OPEN_DURATION = 300;
const CLOSE_DURATION = 240;
// Gap above the sheet (below the notch) so the dimmed screen peeks through,
// mimicking the native sheet inset. Tweak if you want more/less peek.
const TOP_GAP = 8;

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
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [internalVisible, setInternalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(SLIDE_DISTANCE)).current;
  // When true, the next close skips the slide (used by the Add button so the
  // pushed screen just covers this one).
  const skipCloseAnim = useRef(false);
  const s = makeStyles(t);

  useEffect(() => {
    if (visible) {
      skipCloseAnim.current = false;
      setQuery('');
      setInternalVisible(true);
      slideAnim.setValue(SLIDE_DISTANCE);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: OPEN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (internalVisible) {
      if (skipCloseAnim.current) {
        // Instant close — the New screen will cover this one.
        setInternalVisible(false);
      } else {
        Animated.timing(slideAnim, {
          toValue: SLIDE_DISTANCE,
          duration: CLOSE_DURATION,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setInternalVisible(false);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const deviceed = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
      searchKeys.some(key => {
        const val = item[key];
        return val && String(val).toLowerCase().includes(q);
      })
    );
  }, [items, query, searchKeys]);

  const noMatches = query && deviceed.length === 0;
  const showNoneRow = !!onSelectNone && !query;
  const overflow = viewportH > 0 && contentH > viewportH;

  // Add button → close instantly, then let the caller push the New screen.
  const handleAddNew = () => {
    skipCloseAnim.current = true;
    onAddNew && onAddNew();
  };

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={s.modalRoot}>
        <Pressable style={s.backdrop} onPress={onCancel} />

        <Animated.View
          style={[
            s.sheet,
            { top: insets.top + TOP_GAP, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={s.handle} />

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

          <ScrollView
            style={s.list}
            contentContainerStyle={[
              s.listContent,
              { paddingBottom: overflow ? 12 : Math.max(insets.bottom, 12) },
            ]}
            keyboardShouldPersistTaps="handled"
            onLayout={e => setViewportH(e.nativeEvent.layout.height)}
            onContentSizeChange={(w, h) => setContentH(h)}
          >
            {showNoneRow && (
              <Pressable style={s.row} onPress={onSelectNone}>
                <Text style={[s.rowName, !selectedId && s.rowNameOn]}>{noneLabel}</Text>
                {!selectedId && <Text style={s.check}>✓</Text>}
              </Pressable>
            )}

            {deviceed.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyTxt}>{noMatches ? 'No matches' : emptyText}</Text>
              </View>
            )}

            {deviceed.map(item => {
              const on = item.id === selectedId;
              return (
                <Pressable key={item.id} style={s.row} onPress={() => onSelect(item.id)}>
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
            {onAddNew && !overflow && (
              <Pressable style={[s.addBtn, s.addBtnInline]} onPress={handleAddNew}>
                <Text style={s.addBtnTxt}>{addNewLabel}</Text>
              </Pressable>
            )}
          </ScrollView>

          {/* Pinned Add button — drops to the bottom of the sheet, list
              scrolls behind it, once the content is taller than the viewport. */}
          {onAddNew && overflow && (
            <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Pressable style={s.addBtn} onPress={handleAddNew}>
                <Text style={s.addBtnTxt}>{addNewLabel}</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    backdrop: { ...StyleSheet.absoluteFillObject }, // tap-to-dismiss only

    sheet: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      // top is set inline (insets.top + TOP_GAP)
      backgroundColor: t.bg,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 10,
    },
    handle: {
      alignSelf: 'center',
      width: 36, height: 5, borderRadius: 3,
      backgroundColor: t.line,
      marginTop: 8, marginBottom: 2,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 14,
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
    listContent: { paddingHorizontal: 16 },

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