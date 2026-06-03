// app/settings/categories.js
//
// Categories management — drag-to-reorder with the patterns lifted from
// the Hanger app:
//
//   - The screen IS the DraggableFlatList (no outer ScrollView). Header
//     and footer are passed as components so nothing competes for layout
//     after each drop; drag/release feels instant.
//   - Long-press 80ms ANYWHERE on a row to start dragging (the whole row
//     is the grab handle; the visual handle on the right is just an
//     affordance hint).
//   - onDragEnd defers the AsyncStorage write to the next frame so the
//     drop settle animation isn't competing with a synchronous write.
//   - No ScaleDecorator (renders flat during drag — feels better than
//     the default lift-and-scale).
//
// Modal pattern:
//   <Modal> → <View style={s.modalRoot}>  ← THIS gets the dim color
//              <KeyboardAvoidingView>
//                <Pressable style={s.backdrop} /> ← tap-to-dismiss only
//                <View style={s.dialog}> ... </View>
//              </KeyboardAvoidingView>
//             </View>
//           </Modal>
//
// modalRoot is a direct child of Modal with flex:1, so it reliably fills
// the entire modal viewport. The dim color lives there, not on the
// absolutely-positioned backdrop (which had screen-coverage issues).
//
// Protected (Home/Auto/Work) and Uncategorized rules:
//   - Protected: no Edit button at all. Can still drag-reorder. (No "locked"
//     label — the absence of an Edit button is enough of a cue.)
//   - Uncategorized: Edit button shows, but the Edit modal hides the
//     Delete action (it's the orphan fallback, can't be deleted).

import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import {
  loadData, saveData,
  MAX_CATEGORIES,
  addCategory, renameCategory, deleteCategory, reorderCategories,
  assetsInCategory, canRenameCategory, canDeleteCategory,
} from '../../data/store';

export default function CategoriesSettings() {
  const t = useTheme();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    loadData().then(d => {
      if (!active) return;
      setData(d);
      const sorted = [...(d.categories || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
      setCategories(sorted);
    });
    return () => { active = false; };
  }, []));

  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const atCap = categories.length >= MAX_CATEGORIES;

  const persistAndReseed = async (next) => {
    setData(next);
    const sorted = [...(next.categories || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    setCategories(sorted);
    await saveData(next);
  };

  const onDragEnd = ({ data: newOrder }) => {
    setCategories(newOrder);
    requestAnimationFrame(() => {
      const next = reorderCategories(data, newOrder.map(c => c.id));
      setData(next);
      saveData(next).catch(e => console.warn('reorder save failed', e));
    });
  };

  const openAdd = () => {
    setNameInput('');
    setError(null);
    setAddOpen(true);
  };
  const closeAdd = () => {
    setAddOpen(false);
    setNameInput('');
    setError(null);
  };
  const confirmAdd = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    if (atCap) { setError(`You can have up to ${MAX_CATEGORIES} categories.`); return; }
    const exists = (data.categories || []).some(
      c => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) { setError('A category with that name already exists.'); return; }
    const next = addCategory(data, trimmed);
    await persistAndReseed(next);
    closeAdd();
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setNameInput(cat.name);
    setError(null);
  };
  const closeEdit = () => {
    setEditing(null);
    setNameInput('');
    setError(null);
  };
  const confirmEdit = async () => {
    if (!editing) return;
    const trimmed = nameInput.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    if (trimmed === editing.name) { closeEdit(); return; }
    const exists = (data.categories || []).some(
      c => c.id !== editing.id && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) { setError('A category with that name already exists.'); return; }
    const next = renameCategory(data, editing.id, trimmed);
    await persistAndReseed(next);
    closeEdit();
  };
  const confirmDelete = () => {
    if (!editing) return;
    const cat = editing;
    const count = assetsInCategory(data, cat.id);
    const msg = count > 0
      ? `Delete "${cat.name}"? ${count} asset${count === 1 ? '' : 's'} in this category will move to Uncategorized.`
      : `Delete "${cat.name}"? This cannot be undone.`;
    Alert.alert('Delete Category', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const next = deleteCategory(data, cat.id);
          await persistAndReseed(next);
          closeEdit();
        },
      },
    ]);
  };

  const renderRow = ({ item, drag, isActive }) => {
    const count = assetsInCategory(data, item.id);
    const renameable = canRenameCategory(item.id);
    return (
      <Pressable
        onLongPress={drag}
        delayLongPress={80}
        disabled={isActive}
        style={[s.row, isActive && s.rowActive]}
      >
        <View style={s.rowMain}>
          <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.rowMeta}>
            {count} asset{count === 1 ? '' : 's'}
          </Text>
        </View>
        {renameable && (
          <Pressable onPress={() => openEdit(item)} hitSlop={8} style={s.editBtn}>
            <Text style={s.editTxt}>EDIT</Text>
          </Pressable>
        )}
        <Text style={s.dragHandle}>{'\u2261'}</Text>
      </Pressable>
    );
  };

  const header = (
    <View>
      <Text style={s.title}>Categories</Text>
      <Text style={s.sub}>
        Press and hold a row to drag. Home, Auto, and Work cannot be renamed or deleted.
      </Text>
    </View>
  );

  const footer = (
    <View>
      <Pressable
        onPress={openAdd}
        style={[s.addBtn, atCap && s.addBtnDim]}
        disabled={atCap}
      >
        <Text style={s.addBtnTxt}>
          {atCap ? `${MAX_CATEGORIES}/${MAX_CATEGORIES} categories` : '+ Add category'}
        </Text>
      </Pressable>
      <View style={{ height: 24 }} />
    </View>
  );

  const canDelete = editing && canDeleteCategory(editing.id);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.head}>
          <BackButton onPress={() => router.back()} />
          <View />
        </View>

        <DraggableFlatList
          data={categories}
          onDragEnd={onDragEnd}
          activationDistance={12}
          keyExtractor={item => item.id}
          renderItem={renderRow}
          contentContainerStyle={s.listContent}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
        />

        {/* Add Category modal */}
        <Modal visible={addOpen} transparent animationType="fade" onRequestClose={closeAdd}>
          <View style={s.modalRoot}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={s.overlay}
            >
              <Pressable style={s.backdrop} onPress={closeAdd} />
              <View style={s.dialog}>
                <Text style={s.dialogTitle}>Add Category</Text>
                <Text style={s.dialogSub}>
                  {categories.length} of {MAX_CATEGORIES} categories
                </Text>
                <TextInput
                  style={s.input}
                  value={nameInput}
                  onChangeText={(v) => { setNameInput(v); if (error) setError(null); }}
                  placeholder="e.g. Garage"
                  placeholderTextColor={t.muted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={confirmAdd}
                  autoFocus
                />
                {!!error && <Text style={s.errorTxt}>{error}</Text>}
                <View style={s.dialogActions}>
                  <Pressable onPress={closeAdd} style={s.btnSecondary}>
                    <Text style={s.btnSecondaryTxt}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={confirmAdd} style={s.btnPrimary}>
                    <Text style={s.btnPrimaryTxt}>Add</Text>
                  </Pressable>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Edit Category modal (rename + optional delete) */}
        <Modal visible={!!editing} transparent animationType="fade" onRequestClose={closeEdit}>
          <View style={s.modalRoot}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={s.overlay}
            >
              <Pressable style={s.backdrop} onPress={closeEdit} />
              <View style={s.dialog}>
                <Text style={s.dialogTitle}>Edit Category</Text>
                <Text style={s.dialogSub}>
                  Rename{canDelete ? ' or delete' : ''} this category.
                </Text>
                <TextInput
                  style={s.input}
                  value={nameInput}
                  onChangeText={(v) => { setNameInput(v); if (error) setError(null); }}
                  placeholder="Category name"
                  placeholderTextColor={t.muted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={confirmEdit}
                  autoFocus
                />
                {!!error && <Text style={s.errorTxt}>{error}</Text>}
                <View style={s.dialogActions}>
                  <Pressable onPress={closeEdit} style={s.btnSecondary}>
                    <Text style={s.btnSecondaryTxt}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={confirmEdit} style={s.btnPrimary}>
                    <Text style={s.btnPrimaryTxt}>Save</Text>
                  </Pressable>
                </View>
                {canDelete && (
                  <View style={s.deleteSection}>
                    <Pressable onPress={confirmDelete} style={s.deleteBtn}>
                      <Text style={s.deleteTxt}>Delete Category</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
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

    title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16, marginBottom: 18, lineHeight: 18 },

    row: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 13, paddingVertical: 14,
      borderRadius: 10, borderWidth: 1.5, borderColor: t.line,
      backgroundColor: t.card, marginBottom: 6,
    },
    rowActive: { borderColor: t.ink, opacity: 0.95 },
    rowMain: { flex: 1, minWidth: 0 },
    rowName: { fontSize: 15, fontWeight: '600', color: t.ink },
    rowMeta: { fontSize: 12, color: t.muted, marginTop: 2 },

    editBtn: { paddingHorizontal: 6, paddingVertical: 4 },
    editTxt: { fontSize: 12, fontWeight: '700', color: t.inkSoft, letterSpacing: 1.5 },

    dragHandle: { fontSize: 22, color: t.muted, marginLeft: 4 },

    // Matches the "Mark Replaced" button: grey fill, no border, bold black.
    addBtn: {
      marginTop: 12,
      padding: 14,
      borderRadius: t.radius.btn,
      backgroundColor: t.tabIdleBg,
      alignItems: 'center',
    },
    addBtnDim: { opacity: 0.5 },
    addBtnTxt: { fontSize: 15, fontWeight: '700', color: t.ink },

    // Modal root: direct child of <Modal>, flex:1, carries the dim. This is
    // the element we know reliably fills the modal viewport.
    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    backdrop: { ...StyleSheet.absoluteFillObject }, // tap-to-dismiss only
    dialog: {
      width: '85%', maxWidth: 360,
      backgroundColor: t.card, borderRadius: 14, padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 10,
    },
    dialogTitle: { fontSize: 18, fontWeight: '700', color: t.ink, marginBottom: 4 },
    dialogSub: { fontSize: 12, color: t.muted, marginBottom: 14 },
    input: {
      padding: 13, borderRadius: 10, borderWidth: 1.5,
      borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16,
    },
    errorTxt: { fontSize: 13, color: '#b3261e', marginTop: 8 },
    dialogActions: {
      flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
      gap: 12, marginTop: 18,
    },
    btnSecondary: { paddingVertical: 10, paddingHorizontal: 18 },
    btnSecondaryTxt: { fontSize: 14, fontWeight: '600', color: t.inkSoft },
    btnPrimary: {
      paddingVertical: 10, paddingHorizontal: 20,
      borderRadius: 8, backgroundColor: t.tabIdleBg,
    },
    btnPrimaryTxt: { fontSize: 14, fontWeight: '700', color: t.ink },

    deleteSection: {
      marginTop: 18, paddingTop: 14,
      borderTopWidth: 1, borderTopColor: t.line,
      alignItems: 'center',
    },
    deleteBtn: { paddingVertical: 6, paddingHorizontal: 14 },
    deleteTxt: { fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 2, textTransform: 'uppercase' },
  });
}