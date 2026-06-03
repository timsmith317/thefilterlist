// components/TimePickerModal.js
//
// Pick a time of day, returns 'HH:MM' string on confirm.
// Mirrors DatePickerModal but with mode="time" on the native picker.
//
// Animation strategy: see DatePickerModal for the full explanation. Short
// version — Modal uses animationType="none" (dim is instant on/off), and
// we animate only the sheet via Animated.View with translateY. An
// internal `internalVisible` state keeps the Modal mounted through the
// close animation, then unmounts.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, Platform,
  Animated, Easing,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/theme';

const SLIDE_DISTANCE = 500;
const OPEN_DURATION = 280;
const CLOSE_DURATION = 220;

function parseHHMM(s) {
  const d = new Date();
  if (s && /^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(':').map(n => parseInt(n, 10));
    d.setHours(h || 9, m || 0, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

function formatHHMM(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export default function TimePickerModal({
  visible,
  initialTime,         // 'HH:MM' string
  title = 'Pick a time',
  onCancel,
  onConfirm,           // (hhmmString) => void
}) {
  const t = useTheme();
  const [picked, setPicked] = useState(() => parseHHMM(initialTime));
  const [internalVisible, setInternalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(SLIDE_DISTANCE)).current;
  const s = makeStyles(t);

  useEffect(() => {
    if (visible) {
      setPicked(parseHHMM(initialTime));
      setInternalVisible(true);
      slideAnim.setValue(SLIDE_DISTANCE);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: OPEN_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const confirm = () => onConfirm(formatHHMM(picked));

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
            <Pressable onPress={confirm} hitSlop={10} style={s.donePill}>
              <Text style={s.doneTxt}>Done</Text>
            </Pressable>
          </View>

          <View style={s.pickerCenter}>
            <DateTimePicker
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              value={picked}
              onChange={(_evt, d) => { if (d) setPicked(d); }}
              minuteInterval={5}
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
    modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    backdrop: { ...StyleSheet.absoluteFillObject },
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
      paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8,
      borderBottomWidth: 1, borderBottomColor: t.line,
    },
    cancel: { color: t.inkSoft, fontSize: 15 },
    title: { fontSize: 15, fontWeight: '700', color: t.ink },
    donePill: {
      backgroundColor: t.tabIdleBg,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
    },
    doneTxt: {
      color: t.inkSoft,
      fontSize: 14,
      fontWeight: '600',
    },
    pickerCenter: {
      alignItems: 'center',
    },
  });
}
