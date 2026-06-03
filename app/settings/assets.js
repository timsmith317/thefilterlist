// app/settings/assets.js
//
// Active assets management. Two screens total:
//   /settings/assets           ← this file (active list, add, edit, archive)
//   /settings/assets-archived  ← separate (archived list, Actions sheet)
//
// Edit modal uses inline category chips (rather than a nested PickerSheet)
// to avoid the visual issues of opening a modal from inside a modal. With
// MAX_CATEGORIES = 8, chips wrap to two lines max — perfectly readable.
//
// Modal pattern:
//   <Modal> → <View style={s.modalRoot}>  ← carries the dim color
//              <KeyboardAvoidingView>
//                <Pressable style={s.backdrop} /> ← tap-to-dismiss only
//                <View style={s.dialog}> ... </View>
//              </KeyboardAvoidingView>
//             </View>
//           </Modal>

import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import {
  loadData, saveData,
  addAsset, updateAsset, setAssetArchived,
  filtersForAsset,
} from '../../data/store';

export default function AssetsSettings() {
  const t = useTheme();
  const router = useRouter();
  const [data, setData] = useState(null);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [catIdInput, setCatIdInput] = useState(null);
  const [error, setError] = useState(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => { if (active) setData(d); });
    return () => { active = false; };
  }, []));

  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const activeAssets = (data.assets || [])
    .filter(a => !a.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
  const archivedCount = (data.assets || []).filter(a => a.archived).length;
  const categories = ((data.categories || [])).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  const persist = async (next) => {
    setData(next);
    await saveData(next);
  };

  const openAdd = () => {
    const firstCat = categories[0];
    setNameInput('');
    setCatIdInput(firstCat ? firstCat.id : null);
    setError(null);
    setAdding(true);
  };
  const closeAdd = () => {
    setAdding(false); setNameInput(''); setCatIdInput(null); setError(null);
  };
  const confirmAdd = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    if (!catIdInput) { setError('Please pick a category.'); return; }
    const exists = (data.assets || []).some(
      a => !a.archived && a.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) { setError('An asset with that name already exists.'); return; }
    const next = addAsset(data, { name: trimmed, categoryId: catIdInput });
    await persist(next);
    closeAdd();
  };

  const openEdit = (asset) => {
    setEditing(asset);
    setNameInput(asset.name);
    setCatIdInput(asset.categoryId);
    setError(null);
  };
  const closeEdit = () => {
    setEditing(null); setNameInput(''); setCatIdInput(null); setError(null);
  };
  const confirmEdit = async () => {
    if (!editing) return;
    const trimmed = nameInput.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    if (!catIdInput) { setError('Please pick a category.'); return; }
    const exists = (data.assets || []).some(
      a => a.id !== editing.id && !a.archived &&
           a.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) { setError('An asset with that name already exists.'); return; }
    const next = updateAsset(data, editing.id, { name: trimmed, categoryId: catIdInput });
    await persist(next);
    closeEdit();
  };

  const onArchive = () => {
    if (!editing) return;
    const asset = editing;
    const filterCount = filtersForAsset(data, asset.id).length;
    const msg = filterCount > 0
      ? `Archive "${asset.name}"? Its ${filterCount} filter${filterCount === 1 ? '' : 's'} will be hidden until you unarchive it.`
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

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Assets & Archive</Text>
        <Text style={s.sub}>
          Manage homes, cars, offices, and other places with filters.
        </Text>

        <Text style={s.label}>ACTIVE ASSETS</Text>
        {activeAssets.length === 0 && (
          <Text style={s.empty}>No assets yet. Tap + Add Asset below to create your first.</Text>
        )}
        {activeAssets.map(asset => {
          const cat = categories.find(c => c.id === asset.categoryId);
          const filterCount = filtersForAsset(data, asset.id).length;
          return (
            <Pressable
              key={asset.id}
              style={({ pressed }) => [s.card, pressed && s.cardPressed]}
              onPress={() => openEdit(asset)}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardName} numberOfLines={1}>{asset.name}</Text>
                <Text style={s.cardMeta} numberOfLines={1}>
                  {cat ? cat.name : 'Uncategorized'} · {filterCount} filter{filterCount === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={s.chev}>{'\u203A'}</Text>
            </Pressable>
          );
        })}

        <Pressable style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnTxt}>+ Add asset</Text>
        </Pressable>

        {archivedCount > 0 && (
          <Pressable
            style={s.archiveLink}
            onPress={() => router.push('/settings/assets-archived')}
          >
            <Text style={s.archiveLinkTxt}>View archived ({archivedCount})</Text>
            <Text style={s.archiveLinkChev}>{'\u203A'}</Text>
          </Pressable>
        )}
      </ScrollView>

      <AssetModal
        visible={adding}
        title="Add Asset"
        nameInput={nameInput}
        setNameInput={setNameInput}
        catIdInput={catIdInput}
        setCatIdInput={setCatIdInput}
        categories={categories}
        error={error}
        setError={setError}
        onCancel={closeAdd}
        onConfirm={confirmAdd}
        confirmLabel="Add"
        s={s}
        t={t}
      />

      <AssetModal
        visible={!!editing}
        title="Edit Asset"
        nameInput={nameInput}
        setNameInput={setNameInput}
        catIdInput={catIdInput}
        setCatIdInput={setCatIdInput}
        categories={categories}
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
  );
}

function AssetModal({
  visible, title, nameInput, setNameInput, catIdInput, setCatIdInput,
  categories, error, setError, onCancel, onConfirm, confirmLabel,
  bottomAction, s, t,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.modalRoot}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.overlay}
        >
          <Pressable style={s.backdrop} onPress={onCancel} />
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>{title}</Text>

            <Text style={s.dialogLabel}>NAME</Text>
            <TextInput
              style={s.input}
              value={nameInput}
              onChangeText={(v) => { setNameInput(v); if (error) setError(null); }}
              placeholder="e.g. Main House"
              placeholderTextColor={t.muted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={onConfirm}
              autoFocus
            />

            <Text style={s.dialogLabel}>CATEGORY</Text>
            <View style={s.chipWrap}>
              {categories.map(c => {
                const on = catIdInput === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCatIdInput(c.id)}
                    style={[s.chip, on && s.chipOn]}
                  >
                    <Text style={[s.chipTxt, on && s.chipTxtOn]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            {!!error && <Text style={s.errorTxt}>{error}</Text>}

            <View style={s.dialogActions}>
              <Pressable onPress={onCancel} style={s.btnSecondary}>
                <Text style={s.btnSecondaryTxt}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onConfirm} style={s.btnPrimary}>
                <Text style={s.btnPrimaryTxt}>{confirmLabel}</Text>
              </Pressable>
            </View>

            {bottomAction && (
              <View style={s.bottomActionSection}>
                <Pressable onPress={bottomAction.onPress} style={s.bottomActionBtn}>
                  <Text style={s.bottomActionTxt}>{bottomAction.label}</Text>
                </Pressable>
              </View>
            )}
          </View>
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

    scroll: { paddingHorizontal: 18, paddingBottom: 40 },

    title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16, marginBottom: 22, lineHeight: 18 },

    label: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 4, marginBottom: 8, paddingLeft: 13 },
    empty: { fontSize: 13, color: t.muted, fontStyle: 'italic', paddingLeft: 13, paddingVertical: 8 },

    card: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderRadius: 12, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card,
      marginBottom: 10,
    },
    cardPressed: { backgroundColor: t.tabIdleBg },
    cardName: { fontSize: 16, fontWeight: '700', color: t.ink },
    cardMeta: { fontSize: 13, color: t.muted, marginTop: 3 },
    chev: { fontSize: 22, color: t.muted, paddingLeft: 8 },

    // Matches the "Mark Replaced" button: grey fill, no border, bold black.
    addBtn: {
      marginTop: 6,
      padding: 14,
      borderRadius: t.radius.btn,
      backgroundColor: t.tabIdleBg,
      alignItems: 'center',
    },
    addBtnTxt: { fontSize: 15, fontWeight: '700', color: t.ink },

    archiveLink: {
      marginTop: 18, paddingHorizontal: 13,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    archiveLinkTxt: { fontSize: 14, color: t.inkSoft, fontWeight: '600' },
    archiveLinkChev: { fontSize: 20, color: t.muted },

    // Modal root: direct child of <Modal>, flex:1, carries the dim. This is
    // the element we know reliably fills the modal viewport.
    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backdrop: { ...StyleSheet.absoluteFillObject }, // tap-to-dismiss only
    dialog: {
      width: '85%', maxWidth: 380,
      backgroundColor: t.card, borderRadius: 14, padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 10,
    },
    dialogTitle: { fontSize: 18, fontWeight: '700', color: t.ink, marginBottom: 14 },
    dialogLabel: {
      ...t.type.kicker, color: t.muted, textTransform: 'uppercase',
      marginBottom: 8, paddingLeft: 1,
    },
    input: {
      padding: 13, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16,
      marginBottom: 14,
    },
    chipWrap: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4,
    },
    chip: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
      borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card,
    },
    chipOn: { backgroundColor: t.tabIdleBg, borderColor: t.ink },
    chipTxt: { fontSize: 13, fontWeight: '600', color: t.inkSoft },
    chipTxtOn: { color: t.ink, fontWeight: '700' },

    errorTxt: { fontSize: 13, color: '#b3261e', marginTop: 8 },
    dialogActions: {
      flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
      gap: 12, marginTop: 18,
    },
    btnSecondary: { paddingVertical: 10, paddingHorizontal: 18 },
    btnSecondaryTxt: { fontSize: 14, fontWeight: '600', color: t.inkSoft },
    // Grey fill + bold black to match the app's standard buttons.
    btnPrimary: {
      paddingVertical: 10, paddingHorizontal: 20,
      borderRadius: 8, backgroundColor: t.tabIdleBg,
    },
    btnPrimaryTxt: { fontSize: 14, fontWeight: '700', color: t.ink },

    bottomActionSection: {
      marginTop: 18, paddingTop: 14,
      borderTopWidth: 1, borderTopColor: t.line,
      alignItems: 'center',
    },
    bottomActionBtn: { paddingVertical: 6, paddingHorizontal: 14 },
    bottomActionTxt: {
      fontSize: 11, fontWeight: '700', color: t.muted,
      letterSpacing: 2, textTransform: 'uppercase',
    },
  });
}