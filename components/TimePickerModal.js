// components/TimePickerModal.js
//
// Pick a time of day, returns 'HH:MM' string on confirm.
// Mirrors DatePickerModal but with mode="time" on the native picker.

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/theme';

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
  const s = makeStyles(t);

  // Reset to initial whenever the modal opens.
  useEffect(() => {
    if (visible) setPicked(parseHHMM(initialTime));
  }, [visible, initialTime]);

  const confirm = () => onConfirm(formatHHMM(picked));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={s.card}>
          <View style={s.header}>
            <Pressable onPress={onCancel} hitSlop={10}>
              <Text style={s.cancel}>Cancel</Text>
            </Pressable>
            <Text style={s.title}>{title}</Text>
            <Pressable onPress={confirm} hitSlop={10}>
              <Text style={s.done}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            value={picked}
            onChange={(_evt, d) => { if (d) setPicked(d); }}
            minuteInterval={5}
            themeVariant={t.mode === 'dark' ? 'dark' : 'light'}
          />
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    overlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    card: {
      backgroundColor: t.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
      paddingBottom: 18,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
      borderBottomWidth: 1, borderBottomColor: t.line,
    },
    title: { fontSize: 15, fontWeight: '700', color: t.ink },
    cancel: { color: t.inkSoft, fontSize: 15 },
    done: { color: t.ink, fontSize: 15, fontWeight: '700' },
  });
}