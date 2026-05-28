// components/DatePickerModal.js — iOS-style modal sheet wrapping
// DateTimePicker (spinner) with Cancel and Done. Solves the "can't accept
// today" issue: the user always confirms via Done; default value is today
// so Done with no scroll commits today.

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/theme';

export default function DatePickerModal({ visible, initialDate, maximumDate, title = 'Pick a date', onCancel, onConfirm }) {
  const t = useTheme();
  const s = makeStyles(t);
  const [date, setDate] = useState(initialDate || new Date());

  useEffect(() => { if (visible) setDate(initialDate || new Date()); }, [visible, initialDate]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={s.backdrop} onPress={onCancel} />
      <View style={s.sheet}>
        <View style={s.head}>
          <Pressable onPress={onCancel} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={() => onConfirm && onConfirm(date)} hitSlop={10} style={s.donePill}>
            <Text style={s.doneTxt}>Done</Text>
          </Pressable>
        </View>
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
          style={{ alignSelf: 'stretch' }}
          themeVariant={t.mode === 'dark' ? 'dark' : 'light'}
        />
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 24, borderTopWidth: 1, borderColor: t.line },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
    cancel: { color: t.inkSoft, fontSize: 15 },
    title: { fontSize: 14, fontWeight: '700', color: t.ink },
    donePill: { backgroundColor: t.btnBg, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
    doneTxt: { color: t.btnInk, fontSize: 13, fontWeight: '700' },
  });
}
