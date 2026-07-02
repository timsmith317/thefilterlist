// components/NotesModal.js — read-only Notes viewer as a bottom sheet.
//
// Mirrors DatePickerModal's animation/dim strategy exactly so it feels like
// the same family of modal:
//   - Modal uses animationType="none"; the dim is carried by modalRoot and is
//     instant on/off.
//   - The sheet itself slides up on open / down on close via an Animated
//     translateY, and stays mounted through the close animation (internalVisible).
//
// Header is a three-slot row: [flex:1 left | centered title | flex:1 right].
// The left and right slots share width equally, so the centered title stays
// put even when the Copy pill grows to "Copied ✓" — the pill resizes inside
// its own right slot without moving the title.
//
// Copy writes the full notes text to the clipboard via expo-clipboard and
// flips the pill to "Copied ✓" briefly. The notes body scrolls if long; the
// text is selectable for manual copy too.
//
// expo-clipboard is a native module — needs a dev rebuild to take effect.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView,
  Animated, Easing,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../theme/theme';

const SLIDE_DISTANCE = 600;
const OPEN_DURATION = 280;
const CLOSE_DURATION = 220;
const COPIED_RESET_MS = 1600;

export default function NotesModal({ visible, notes = '', title = 'Notes', onCancel }) {
  const t = useTheme();
  const s = makeStyles(t);
  const [internalVisible, setInternalVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const slideAnim = useRef(new Animated.Value(SLIDE_DISTANCE)).current;
  const copyTimer = useRef(null);

  useEffect(() => {
    if (visible) {
      // Opening: reset copied state, mount the Modal, slide the sheet up.
      setCopied(false);
      setInternalVisible(true);
      slideAnim.setValue(SLIDE_DISTANCE);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: OPEN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      // Closing: slide the sheet down first, then unmount the Modal.
      Animated.timing(slideAnim, {
        toValue: SLIDE_DISTANCE,
        duration: CLOSE_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setInternalVisible(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Clear the "Copied ✓" reset timer on unmount.
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(notes || '');
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch (e) {
      // Copy failing is non-critical — stay quiet rather than alert.
    }
  };

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={s.modalRoot}>
        <Pressable style={s.backdrop} onPress={onCancel} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.head}>
            <View style={s.headSlot}>
              <Pressable onPress={onCancel} hitSlop={10}>
                <Text style={s.cancel}>Cancel</Text>
              </Pressable>
            </View>

            <Text style={s.title}>{title}</Text>

            <View style={[s.headSlot, s.headSlotRight]}>
              <Pressable onPress={onCopy} hitSlop={10} style={s.copyPill}>
                <Text style={s.copyTxt}>{copied ? 'Copied ✓' : 'Copy'}</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={s.bodyScroll}
            contentContainerStyle={s.bodyContent}
            showsVerticalScrollIndicator
          >
            <Text style={s.notesText} selectable>{notes}</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    // Flex root carries the dim — instant on/off (Modal animationType="none").
    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },

    // Tap-to-dismiss only — no color.
    backdrop: { ...StyleSheet.absoluteFillObject },

    // Bottom sheet — anchored to the bottom; translateY animates open/close.
    sheet: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
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

    // Three-slot header. Left/right slots are flex:1 (equal width), so the
    // intrinsic-width centered title sits dead-center regardless of what the
    // right pill's label is.
    head: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: t.line,
    },
    headSlot: { flex: 1, justifyContent: 'center', alignItems: 'flex-start' },
    headSlotRight: { alignItems: 'flex-end' },

    cancel: { color: t.inkSoft, fontSize: t.uit(15) },
    title: { fontSize: t.uit(15), fontWeight: '700', color: t.ink, textAlign: 'center' },

    // minWidth so the pill barely changes size between "Copy" and "Copied ✓";
    // even if it did, the title no longer depends on it.
    copyPill: {
      backgroundColor: t.tabIdleBg,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      minWidth: 92,
      alignItems: 'center',
    },
    copyTxt: { color: t.ink, fontSize: t.uit(14), fontWeight: '700' },

    // Cap the body height so a long note scrolls instead of growing the sheet
    // past the screen.
    bodyScroll: { maxHeight: 360 },
    bodyContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    notesText: { color: t.ink, fontSize: t.uit(15), lineHeight: 22 },
  });
}