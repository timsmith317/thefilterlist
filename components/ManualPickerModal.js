// components/ManualPickerModal.js — set a Device's owner's manual.
//
// A bottom sheet (same dim/slide family as NotesModal/DatePickerModal) for the
// owner's manual, which can hold a WEB LINK and/or a FILE — independently. Both
// are shown at once: type a link, pick a file, or do both. Whatever is set is
// what shows on the device; leaving one blank just omits it.
//   - WEB LINK: a web page or a cloud share link (OneDrive/Dropbox/iCloud).
//   - FILE: a PDF/scan from the iOS Files browser; the app keeps a copy so it
//     opens offline. The pick is a CACHE uri here — the form persists it on its
//     own Save, so a Cancel never orphans a file.
//
// The action is "Done" (not "Save") to make clear it returns you to the device
// form — you still tap the form's Save to keep the change. onSave returns
// { url, file } (file may be null).
//
// Keyboard: the sheet sits in a flex-end KeyboardAvoidingView so the URL input
// lifts above the keyboard.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, TextInput,
  Animated, Easing, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '../theme/theme';
import { pickManualFile } from '../lib/manualFile';

const SLIDE_DISTANCE = 600;
const OPEN_DURATION = 280;
const CLOSE_DURATION = 220;

export default function ManualPickerModal({ visible, value = null, onCancel, onSave }) {
  const t = useTheme();
  const s = makeStyles(t);
  const [internalVisible, setInternalVisible] = useState(false);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);   // { uri, name } | null
  const slideAnim = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => {
    if (visible) {
      setUrl((value && value.url) || '');
      setFile((value && value.file) || null);

      setInternalVisible(true);
      slideAnim.setValue(SLIDE_DISTANCE);
      Animated.timing(slideAnim, {
        toValue: 0, duration: OPEN_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SLIDE_DISTANCE, duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(({ finished }) => { if (finished) setInternalVisible(false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const chooseFile = async () => {
    const f = await pickManualFile();
    if (f) setFile(f);
  };

  const done = () => onSave({ url: url.trim(), file });

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onCancel} />
        <KeyboardAvoidingView
          style={s.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={s.head}>
              <View style={s.headSlot}>
                <Pressable onPress={onCancel} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
              </View>
              <Text style={s.title}>Owner's Manual</Text>
              <View style={[s.headSlot, s.headSlotRight]}>
                <Pressable onPress={done} hitSlop={10} style={s.donePill}><Text style={s.doneTxt}>Done</Text></Pressable>
              </View>
            </View>

            <View style={s.body}>
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
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    kav: { flex: 1, justifyContent: 'flex-end' },

    sheet: {
      backgroundColor: t.bg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingBottom: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 10,
    },

    head: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: t.line,
    },
    headSlot: { flex: 1, justifyContent: 'center', alignItems: 'flex-start' },
    headSlotRight: { alignItems: 'flex-end' },
    cancel: { color: t.inkSoft, fontSize: 15 },
    title: { fontSize: 15, fontWeight: '700', color: t.ink, textAlign: 'center' },
    donePill: { backgroundColor: t.tabIdleBg, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, minWidth: 72, alignItems: 'center' },
    doneTxt: { color: t.ink, fontSize: 14, fontWeight: '700' },

    body: { paddingHorizontal: 20, paddingTop: 18 },
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