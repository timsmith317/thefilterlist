// app/settings/assets.js
//
// Active assets management with drag-to-reorder. Two screens total:
//   /settings/assets           ← this file (active list, reorder, add, edit)
//   /settings/assets-archived  ← separate (archived list, Actions sheet)
//
// Drag-to-reorder uses the same pattern as the old Categories screen (itself
// lifted from Hanger):
//   - The screen IS the DraggableFlatList (no outer ScrollView). Header and
//     footer are passed as components so nothing competes for layout on drop.
//   - Long-press 80ms ANYWHERE on a row starts a drag; the ≡ on the right is
//     just an affordance hint. No ScaleDecorator (flat during drag).
//   - onDragEnd defers the AsyncStorage write to the next frame.
//
// Locked defaults (House / Auto / Office — see PROTECTED_ASSET_IDS):
//   - No chevron, and tapping does nothing. They can't be renamed or archived.
//   - They CAN still be dragged to reorder. canDeleteAsset(id) === false marks
//     them locked.
//
// "+ Add asset" routes to /asset/new (shared with the Choose Asset picker).
// Editing a non-locked asset opens a full-screen sheet (Cancel / Save at top,
// Archive at the bottom) that mirrors the New Asset page.

import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList from 'react-native-draggable-flatlist';
import useFixScrollToTop from '../../lib/useFixScrollToTop';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton, PillButton } from '../../components/HeaderBits';
import {
  loadData, saveData,
  reorderAssets, updateAsset, setAssetArchived,
  devicesForAsset, canDeleteAsset,
} from '../../data/store';

export default function AssetsSettings() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollsToTop = useFixScrollToTop();
  const [data, setData] = useState(null);
  const [assets, setAssets] = useState([]); // active, in order — the drag list

  // Hug-then-pin Add button: when content is taller than the viewport, the
  // button pins to the bottom and the list scrolls behind it; otherwise it
  // sits inline hugging the list.
  const [viewportH, setViewportH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [footerH, setFooterH] = useState(0);

  const [editing, setEditing] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState(null);

  const reseed = (d) => {
    const active = (d.assets || [])
      .filter(a => !a.archived)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    setAssets(active);
  };

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => { if (active) { setData(d); reseed(d); } });
    return () => { active = false; };
  }, []));

  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const overflow = viewportH > 0 && contentH > viewportH;

  const persist = async (next) => { setData(next); reseed(next); await saveData(next); };

  const onDragEnd = ({ data: newOrder }) => {
    setAssets(newOrder); // optimistic — keep the dropped order on screen
    requestAnimationFrame(() => {
      const next = reorderAssets(data, newOrder.map(a => a.id));
      setData(next);
      saveData(next).catch(e => console.warn('reorder save failed', e));
    });
  };

  const openEdit = (asset) => { setEditing(asset); setNameInput(asset.name); setError(null); };
  const closeEdit = () => { setEditing(null); setNameInput(''); setError(null); };

  const confirmEdit = async () => {
    if (!editing) return;
    const trimmed = nameInput.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    const exists = (data.assets || []).some(
      a => a.id !== editing.id && !a.archived &&
           a.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) { setError('An asset with that name already exists.'); return; }
    const next = updateAsset(data, editing.id, { name: trimmed });
    await persist(next);
    closeEdit();
  };

  const onArchive = () => {
    if (!editing) return;
    const asset = editing;
    const deviceCount = devicesForAsset(data, asset.id).length;
    const msg = deviceCount > 0
      ? `Archive "${asset.name}"? Its ${deviceCount} device${deviceCount === 1 ? '' : 's'} will be hidden until you unarchive it.`
      : `Archive "${asset.name}"?`;
    Alert.alert('Archive Asset', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive',
        onPress: async () => {
          const next = setAssetArchived(data, asset.id, true);
          await persist(next);
          closeEdit();
        },
      },
    ]);
  };

  const renderRow = ({ item, drag, isActive }) => {
    const locked = !canDeleteAsset(item.id); // House / Auto / Office
    const deviceCount = devicesForAsset(data, item.id).length;
    return (
      <Pressable
        onLongPress={drag}
        delayLongPress={80}
        disabled={isActive}
        onPress={locked ? undefined : () => openEdit(item)}
        style={[s.row, isActive && s.rowActive]}
      >
        <View style={s.rowMain}>
          <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.rowMeta} numberOfLines={1}>
            {deviceCount} device{deviceCount === 1 ? '' : 's'}
          </Text>
        </View>
        {!locked && <Text style={s.chev}>{'\u203A'}</Text>}
        <Text style={s.dragHandle}>{'\u2261'}</Text>
      </Pressable>
    );
  };

  const header = (
    <View>
      <Text style={s.title}>Assets & Archive</Text>
      <Text style={s.sub}>
        Press and hold a row to reorder.
      </Text>
      <View style={s.labelRow}>
        <Text style={s.label}>ACTIVE ASSETS</Text>
      </View>
    </View>
  );

  const inlineFooter = (
    <View>
      <Pressable style={[s.addBtn, s.addBtnInline]} onPress={() => router.push('/asset/new')}>
        <Text style={s.addBtnTxt}>+ Add asset</Text>
      </Pressable>
      <View style={{ height: 24 }} />
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.head}>
          <BackButton onPress={() => router.back()} />
          <PillButton label="Archive" onPress={() => router.push('/settings/assets-archived')} />
        </View>

        <DraggableFlatList
          data={assets}
          scrollsToTop={scrollsToTop}
          containerStyle={{ flex: 1 }}
          onContainerLayout={({ layout }) => setViewportH(layout.height)}
          onContentSizeChange={(w, h) => setContentH(h)}
          onDragEnd={onDragEnd}
          activationDistance={12}
          keyExtractor={item => item.id}
          renderItem={renderRow}
          contentContainerStyle={[s.listContent, overflow && { paddingBottom: footerH + 16 }]}
          ListHeaderComponent={header}
          ListFooterComponent={overflow ? null : inlineFooter}
          ListEmptyComponent={<Text style={s.empty}>No assets yet. Tap + Add asset below to create your first.</Text>}
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
        />

        {overflow && (
          <View
            style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
            onLayout={e => setFooterH(e.nativeEvent.layout.height)}
          >
            <Pressable style={s.addBtn} onPress={() => router.push('/asset/new')}>
              <Text style={s.addBtnTxt}>+ Add asset</Text>
            </Pressable>
          </View>
        )}

        <AssetModal
          visible={!!editing}
          title="Edit Asset"
          nameInput={nameInput}
          setNameInput={setNameInput}
          error={error}
          setError={setError}
          onCancel={closeEdit}
          onConfirm={confirmEdit}
          confirmLabel="Save"
          bottomAction={{ label: 'Archive', onPress: onArchive }}
          s={s}
          t={t}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// Full-screen Edit Asset sheet (mirrors app/asset/new.js): Cancel top-left,
// Save pill top-right, big title, NAME field, Archive as a bottom action.
function AssetModal({
  visible, title, nameInput, setNameInput,
  error, setError, onCancel, onConfirm, confirmLabel,
  bottomAction, s, t,
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={s.sheetSafe}>
        <View style={s.sheetHead}>
          <Pressable onPress={onCancel} hitSlop={10}><Text style={s.sheetCancel}>Cancel</Text></Pressable>
          <PillButton label={confirmLabel} onPress={onConfirm} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.sheetTitle}>{title}</Text>
            <Text style={s.sheetSub}>Rename this asset, or archive it to hide its devices.</Text>

            <Text style={s.sheetLabel}>NAME</Text>
            <TextInput
              style={s.input}
              value={nameInput}
              onChangeText={(v) => { setNameInput(v); if (error) setError(null); }}
              placeholder="e.g. House"
              placeholderTextColor={t.muted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={onConfirm}
            />

            {!!error && <Text style={s.errorTxt}>{error}</Text>}

            {bottomAction && (
              <Pressable style={s.sheetBottomAction} onPress={bottomAction.onPress}>
                <Text style={s.sheetBottomActionTxt}>{bottomAction.label}</Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6,
    },

    listContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 18 },

    title: { ...t.type.screenTitle, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: t.uit(13), color: t.muted, marginTop: 4, paddingLeft: 16, marginBottom: 18, lineHeight: 18 },

    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 18 },
    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', paddingLeft: 13, marginBottom: 8 },
    empty: { fontSize: t.uit(14), color: t.muted, paddingLeft: 13, paddingTop: 4, lineHeight: 20 },

    row: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 14, paddingVertical: 14,
      borderRadius: 12, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card, marginBottom: 8,
    },
    rowActive: { borderColor: t.ink, opacity: 0.95 },
    rowMain: { flex: 1, minWidth: 0 },
    rowName: { fontSize: t.uit(16), fontWeight: '700', color: t.ink },
    rowMeta: { fontSize: t.uit(13), color: t.muted, marginTop: 3 },

    chev: { fontSize: t.uit(22), color: t.muted, paddingLeft: 4 },
    dragHandle: { fontSize: t.uit(22), color: t.muted, marginLeft: 2 },

    // "Mark Replaced"-style button: grey fill, no border, bold black.
    addBtn: { padding: 14, borderRadius: t.radius.btn, backgroundColor: t.tabIdleBg, alignItems: 'center' },
    addBtnInline: { marginTop: 12 },
    addBtnTxt: { fontSize: t.uit(15), fontWeight: '700', color: t.ink },

    footer: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      backgroundColor: t.bg, paddingHorizontal: 18, paddingTop: 10,
    },

    // Full-screen Edit Asset sheet.
    sheetSafe: { flex: 1, backgroundColor: t.bg },
    sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 },
    sheetCancel: { color: t.inkSoft, fontSize: t.uit(15) },
    sheetTitle: { ...t.type.title, fontSize: t.uit(26), color: t.ink, marginTop: 4, paddingLeft: 16 },
    sheetSub: { fontSize: t.uit(13), color: t.muted, marginTop: 4, paddingLeft: 16 },
    sheetLabel: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingLeft: 13 },
    sheetBottomAction: { marginTop: 32, paddingTop: 18, borderTopWidth: 1, borderTopColor: t.line, alignItems: 'center' },
    sheetBottomActionTxt: { fontSize: t.uit(14), fontWeight: '700', letterSpacing: 0.5, color: t.inkSoft, textTransform: 'uppercase' },

    input: { height: 50, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: t.uit(16) },
    errorTxt: { fontSize: t.uit(13), color: '#b3261e', marginTop: 12, paddingLeft: 13 },
  });
}