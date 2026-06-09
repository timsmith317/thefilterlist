// components/MarkReplacedSheet.js — per-stage Mark Replaced bottom sheet.
//
// Multi-stage devices open this instead of going straight to a date picker.
//   Phase 'select' — a checklist of the device's stages (pre-checked: the ones
//     currently due or overdue; if none are due, all are checked) plus a
//     "Replaced on" date row. Done applies the chosen date to ONLY the checked
//     stages and recalculates only their due dates.
//   Phase 'date' — an inline spinner to choose the replaced-on date. Set keeps
//     it, Cancel discards it (consistent with the rest of the app's pickers).
//
// One sheet, no nested modals: the spinner swaps in over the checklist so we
// never stack two Modals (which is glitchy on iOS). Slide/dim animation
// mirrors DatePickerModal exactly.
//
// Each stage row: checkbox (white box, black check) + name with the stage's
// status pill on the title line + the schedule sub-line on its own full-width
// row beneath (so it doesn't truncate behind the pill).

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, Platform,
  Animated, Easing, ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/theme';

const SLIDE_DISTANCE = 600;
const OPEN_DURATION = 280;
const CLOSE_DURATION = 220;

// Border color of the checkbox WHEN CHECKED. This is the value to dial:
// higher/darker hex (e.g. '#707070') = starker; lower/lighter (e.g. '#E0E0E0')
// = softer, closer to the unchecked border. Unchecked uses the theme's line.
const CHECKED_BORDER = '#B0B0B0';

export default function MarkReplacedSheet({
  visible,
  stages = [],
  title = 'Mark Replaced',
  onCancel,
  onConfirm,
}) {
  const t = useTheme();
  const s = makeStyles(t);
  const [internalVisible, setInternalVisible] = useState(false);
  const [phase, setPhase] = useState('select');
  const [checked, setChecked] = useState(() => new Set());
  const [date, setDate] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());   // edited in the 'date' phase
  const slideAnim = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => {
    if (visible) {
      // Pre-check the due/overdue stages; if none are due, check all.
      const due = stages.filter(st => st.status && st.status.key !== 'grn').map(st => st.id);
      setChecked(new Set(due.length ? due : stages.map(st => st.id)));
      setDate(new Date());
      setPhase('select');
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

  const toggle = (id) => {
    setChecked(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();
  const count = checked.size;
  const confirm = () => { if (count > 0 && onConfirm) onConfirm([...checked], date); };

  // Open the date step editing a copy; Set commits it, Cancel discards it.
  const openDate = () => { setTempDate(date); setPhase('date'); };
  const setDateAndBack = () => { setDate(tempDate); setPhase('select'); };
  const cancelDate = () => setPhase('select');

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={s.modalRoot}>
        <Pressable style={s.backdrop} onPress={onCancel} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {phase === 'select' ? (
            <>
              <View style={s.head}>
                <Pressable onPress={onCancel} hitSlop={10}>
                  <Text style={s.cancel}>Cancel</Text>
                </Pressable>
                <Text style={s.title}>{title}</Text>
                <Pressable
                  onPress={confirm}
                  hitSlop={10}
                  disabled={count === 0}
                  style={[s.donePill, count === 0 && s.donePillOff]}
                >
                  <Text style={[s.doneTxt, count === 0 && s.doneTxtOff]}>Done</Text>
                </Pressable>
              </View>
              <Text style={s.helper}>Check the stages you replaced.</Text>

              <ScrollView style={s.listWrap} contentContainerStyle={s.listContent}>
                {stages.map(st => {
                  const on = checked.has(st.id);
                  const tone = st.status ? t.status[st.status.key] : null;
                  return (
                    <Pressable key={st.id} style={s.row} onPress={() => toggle(st.id)}>
                      <View style={[s.box, on && s.boxOn]}>
                        {on && <Text style={s.check}>✓</Text>}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={s.rowTop}>
                          <Text style={s.rowName} numberOfLines={1}>{st.label}</Text>
                          {tone && (
                            <View style={[s.pill, { backgroundColor: tone.pillBg }]}>
                              <Text style={[s.pillTxt, { color: tone.pillInk }]}>{st.status.label}</Text>
                            </View>
                          )}
                        </View>
                        {!!st.sub && <Text style={s.rowSub} numberOfLines={1}>{st.sub}</Text>}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable style={s.dateRow} onPress={openDate}>
                <Text style={s.dateLabel}>Replaced on</Text>
                <View style={s.dateVal}>
                  <Text style={s.dateValTxt}>{isToday(date) ? 'Today' : fmt(date)}</Text>
                  <Text style={s.dateChev}>›</Text>
                </View>
              </Pressable>
            </>
          ) : (
            <>
              <View style={s.head}>
                <Pressable onPress={cancelDate} hitSlop={10}>
                  <Text style={s.cancel}>Cancel</Text>
                </Pressable>
                <Text style={s.title}>Replaced On</Text>
                <Pressable onPress={setDateAndBack} hitSlop={10} style={s.donePill}>
                  <Text style={s.doneTxt}>Set</Text>
                </Pressable>
              </View>
              <View style={s.pickerCenter}>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(_e, d) => { if (d) setTempDate(d > new Date() ? new Date() : d); }}
                  themeVariant={t.mode === 'dark' ? 'dark' : 'light'}
                />
              </View>
            </>
          )}
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
      position: 'absolute', left: 0, right: 0, bottom: 0,
      backgroundColor: t.bg,
      borderTopLeftRadius: 18, borderTopRightRadius: 18,
      paddingBottom: 24,
      shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
    },
    head: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6,
    },
    cancel: { color: t.inkSoft, fontSize: 15 },
    title: { fontSize: 15, fontWeight: '700', color: t.ink },
    donePill: { backgroundColor: t.tabIdleBg, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
    donePillOff: { opacity: 0.4 },
    doneTxt: { color: t.ink, fontSize: 14, fontWeight: '700' },
    doneTxtOff: { color: t.muted },

    helper: { color: t.muted, fontSize: 13, paddingHorizontal: 18, paddingBottom: 4 },

    listWrap: { maxHeight: 300 },
    listContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 4 },

    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
    // White box, no fill — checked just shows a black check (border darkens a touch).
    box: {
      width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: t.line,
      alignItems: 'center', justifyContent: 'center', backgroundColor: t.card,
    },
    boxOn: { borderColor: CHECKED_BORDER },
    check: { color: t.ink, fontSize: 14, fontWeight: '600', lineHeight: 16 },

    // Name + status pill share the title line; the schedule sub-line gets its
    // own full-width row beneath so it never truncates behind the pill.
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    rowName: { fontSize: 15, fontWeight: '700', color: t.ink, flex: 1, marginRight: 8 },
    rowSub: { fontSize: 12, color: t.muted, marginTop: 2 },

    pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: t.radius.pill },
    pillTxt: { ...t.type.pill },

    dateRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 6, marginHorizontal: 18, paddingVertical: 14, paddingHorizontal: 14,
      backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: t.radius.btn,
    },
    dateLabel: { fontSize: 14, fontWeight: '400', color: t.inkSoft },
    dateVal: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dateValTxt: { fontSize: 14, fontWeight: '700', color: t.ink },
    dateChev: { fontSize: 17, color: t.muted, fontWeight: '700' },

    pickerCenter: { alignItems: 'center' },
  });
}
