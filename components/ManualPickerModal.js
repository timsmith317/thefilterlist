// components/ManualPickerModal.js — set a Device's owner's manual.
//
// iOS SHEET (presentationStyle="pageSheet"), matching the icon picker: the card
// is inset from the top with rounded corners and the form peeks behind it, so it
// clearly reads as a modal.
//
// The owner's manual can hold a WEB LINK and/or a FILE — independently. Both are
// shown at once: type a link, pick a file, or do both. Whatever is set is what
// shows on the device; leaving one blank just omits it.
//   - WEB LINK: a web page or a cloud share link (OneDrive/Dropbox/iCloud).
//   - FILE: a PDF/scan from the iOS Files browser; the app keeps a copy so it
//     opens offline. The pick is a CACHE uri here — the form persists it on its
//     own Save, so a Cancel never orphans a file.
//
// The action is "Done" (not "Save") to make clear it returns you to the device
// form — you still tap the form's Save to keep the change. onSave returns
// { url, file } (file may be null). Unlike the icon picker, this commits on Done
// rather than on tap, since the user composes two fields before returning.
//
// Keyboard: the URL field sits near the top of a tall sheet, so it can't be
// covered; the ScrollView's automaticallyAdjustKeyboardInsets handles any inset
// without the flex-end avoider the old bottom sheet needed.

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';
import { pickManualFile } from '../lib/manualFile';

export default function ManualPickerModal({ visible, value = null, onCancel, onSave }) {
  const t = useTheme();
  const s = makeStyles(t);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);   // { uri, name } | null

  // Load the current value into the fields each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setUrl((value && value.url) || '');
      setFile((value && value.file) || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const chooseFile = async () => {
    const f = await pickManualFile();
    if (f) setFile(f);
  };

  const done = () => onSave({ url: url.trim(), file });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <View style={s.head}>
            <View style={s.headSlot}>
              <Pressable onPress={onCancel} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
            </View>
            <Text style={s.title}>Owner's Manual</Text>
            <View style={[s.headSlot, s.headSlotRight]}>
              <Pressable onPress={done} hitSlop={10} style={s.donePill}><Text style={s.doneTxt}>Done</Text></Pressable>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.kicker}>WEB LINK</Text>
            <TextInput
              style={s.input}
              value={url}
              onChangeText={setUrl}
              placeholder="Web page or cloud share link"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <Text style={[s.kicker, { marginTop: 22 }]}>FILE</Text>
            {file ? (
              <>
                <View style={s.fileChip}>
                  <Text style={s.fileName} numberOfLines={1}>{file.name || 'Selected file'}</Text>
                  <Pressable onPress={() => setFile(null)} hitSlop={10}><Text style={s.removeX}>✕</Text></Pressable>
                </View>
                <Pressable style={[s.fileBtn, { marginTop: 10 }]} onPress={chooseFile}>
                  <Text style={s.fileBtnTxt}>Choose a different file</Text>
                </Pressable>
                <Text style={s.hint}>Saved in the app and available offline.</Text>
              </>
            ) : (
              <>
                <Pressable style={s.fileBtn} onPress={chooseFile}>
                  <Text style={s.fileBtnTxt}>Choose a file…</Text>
                </Pressable>
                <Text style={s.hint}>Pick a PDF from Files, iCloud, OneDrive, or Dropbox — the app keeps a copy so it opens offline.</Text>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    safe: { flex: 1 },

    head: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: t.line,
    },
    headSlot: { flex: 1, justifyContent: 'center', alignItems: 'flex-start' },
    headSlotRight: { alignItems: 'flex-end' },
    cancel: { color: t.inkSoft, fontSize: 16 },
    title: { fontSize: 16, fontWeight: '700', color: t.ink, textAlign: 'center' },
    donePill: { backgroundColor: t.tabIdleBg, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, minWidth: 72, alignItems: 'center' },
    doneTxt: { color: t.ink, fontSize: 14, fontWeight: '700' },

    scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
    kicker: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginBottom: 8 },

    input: { height: 50, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card, color: t.ink, fontSize: 16 },

    fileBtn: { padding: 14, borderRadius: 10, backgroundColor: t.tabIdleBg, alignItems: 'center' },
    fileBtnTxt: { color: t.ink, fontSize: 15, fontWeight: '700' },

    fileChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card },
    fileName: { color: t.ink, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 10 },
    removeX: { color: t.muted, fontSize: 15, fontWeight: '700' },

    hint: { fontSize: 12, color: t.muted, marginTop: 12 },
  });
}
