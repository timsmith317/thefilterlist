// components/DatePickerModal.js — iOS-style bottom-sheet wrapping
// DateTimePicker (spinner) with Cancel and Done.
//
// Solves the "can't accept today" issue: the user always confirms via Done;
// default value is today so Done with no scroll commits today.
//
// Animation strategy:
//
//   The Modal uses animationType="none" so the OS does NOT animate
//   anything. We then animate only the sheet ourselves via Animated.View
//   with a translateY transform. This separates dim from slide:
//
//     - Dim is part of the modalRoot View — when the Modal is mounted,
//       the dim is instantly on; when unmounted, instantly off. No
//       fade, no slide.
//     - Sheet slides up on open, slides down on close.
//
//   Because the parent sets `visible=false` on Cancel/Done, which would
//   normally unmount the Modal immediately and skip any close animation,
//   we track an internal `internalVisible` state. The Modal stays mounted
//   until the slide-down animation finishes, then unmounts.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, Platform,
  Animated, Easing,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/theme';

// Distance to slide the sheet from off-screen. 500 is more than any
// picker sheet height, so the sheet is fully below the screen at start
// of open / end of close.
const SLIDE_DISTANCE = 500;
const OPEN_DURATION = 280;
const CLOSE_DURATION = 220;

export default function DatePickerModal({ visible, initialDate, maximumDate, title = 'Pick a date', onCancel, onConfirm }) {
  const t = useTheme();
  const s = makeStyles(t);
  const [date, setDate] = useState(initialDate || new Date());
  const [internalVisible, setInternalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => {
    if (visible) {
      // Opening: reset date, mount the Modal, slide the sheet up.
      setDate(initialDate || new Date());
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

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={s.modalRoot}>
        <Pressable style={s.backdrop} onPress={onCancel} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.head}>
            <Pressable onPress={onCancel} hitSlop={10}>
              <Text style={s.cancel}>Cancel</Text>
            </Pressable>
            <Text style={s.title}>{title}</Text>
            <Pressable onPress={() => onConfirm && onConfirm(date)} hitSlop={10} style={s.donePill}>
              <Text style={s.doneTxt}>Done</Text>
            </Pressable>
          </View>

          {/* Centering wrapper: lets the native spinner take its intrinsic
              width and sit in the horizontal middle of the modal. */}
          <View style={s.pickerCenter}>
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={maximumDate}
              // The library deprecated `onChange` in favor of `onValueChange`.
              // We provide BOTH so this component works on whichever version
              // is installed without warnings or breakage.
              onChange={(_e, d) => { if (d) setDate(d); }}
              onValueChange={(_e, d) => { if (d) setDate(d); }}
              themeVariant={t.mode === 'dark' ? 'dark' : 'light'}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    // Flex root — carries the dim. Dim is instant on/off (no animation)
    // because the Modal uses animationType="none".
    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },

    // Tap-to-dismiss only — no color.
    backdrop: { ...StyleSheet.absoluteFillObject },

    // Bottom sheet — anchored to the bottom of the modalRoot. translateY
    // is animated to slide it up on open / down on close.
    sheet: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      backgroundColor: t.bg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 10,
    },
    head: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6,
    },
    cancel: { color: t.inkSoft, fontSize: 15 },
    title: { fontSize: 15, fontWeight: '700', color: t.ink },

    donePill: {
      backgroundColor: t.tabIdleBg,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
    },
    // Bold + full black to match the app's pill labels.
    doneTxt: {
      color: t.ink,
      fontSize: 14,
      fontWeight: '700',
    },
    pickerCenter: {
      alignItems: 'center',
    },
  });
}