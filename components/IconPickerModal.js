// components/IconPickerModal.js — choose a Device's icon.
//
// Same dim/slide bottom-sheet family as NotesModal / ManualPickerModal. Two
// ways to set the icon:
//   1. AUTO — clears the override; the device falls back to the derived
//      water/air/other glyph (its default behavior).
//   2. A grid of glyph tiles (SF Symbols). It leads with the app's own water
//      (SF "humidity") and air (SF "fan") marks so they're first-class picks,
//      then common home / auto / appliance symbols. Tiles show the glyph only —
//      no cryptic symbol names for the user to decode.
//
// No free-text field: names like "humidity" mean nothing to users, and a text
// input inside a bottom sheet traps the keyboard. To offer more symbols, just
// extend CURATED below (verify names in Apple's SF Symbols app).
//
// onSave returns the chosen SF Symbol name, or null for AUTO. expo-symbols is a
// native module — symbols render only in a dev/standalone build, not Expo Go.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Animated, Easing } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '../theme/theme';
import { IconOther } from '../theme/Icons';

const SLIDE_DISTANCE = 600;
const OPEN_DURATION = 280;
const CLOSE_DURATION = 220;

// Glyph grid. Leads with the app's own water/air marks (SF "humidity"/"fan"),
// then common appliance/home/water symbols. Edit freely; an unknown name simply
// renders the generic fallback tile.
const CURATED = [
  'humidity',                          // water (the app's built-in water mark)
  'fan',                               // air (the app's built-in air mark)
  'drop.fill',
  'refrigerator.fill',
  'air.conditioner.horizontal.fill',
  'humidifier.fill',
  'wind',
  'house.fill',
  'car.fill',
  'washer.fill',
  'shower.fill',
  'spigot.fill',
  'flame.fill',
  'thermometer',
  'gauge.with.dots.needle.bottom.50percent',
];

export default function IconPickerModal({ visible, value = null, onCancel, onSave }) {
  const t = useTheme();
  const s = makeStyles(t);
  const [internalVisible, setInternalVisible] = useState(false);
  const [selected, setSelected] = useState('');   // '' = Auto
  const slideAnim = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => {
    if (visible) {
      setSelected(value || '');
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

  const done = () => onSave(selected.trim() ? selected.trim() : null);

  return (
    <Modal visible={internalVisible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onCancel} />
        <View style={s.dock} pointerEvents="box-none">
          <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={s.head}>
              <View style={s.headSlot}>
                <Pressable onPress={onCancel} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
              </View>
              <Text style={s.title}>Icon</Text>
              <View style={[s.headSlot, s.headSlotRight]}>
                <Pressable onPress={done} hitSlop={10} style={s.donePill}><Text style={s.doneTxt}>Done</Text></Pressable>
              </View>
            </View>

            <View style={s.body}>
              {/* AUTO */}
              <Pressable style={[s.autoRow, selected === '' && s.autoRowOn]} onPress={() => setSelected('')}>
                <View style={s.autoIcon}><IconOther size={22} color={t.iconInk} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.autoName}>Auto</Text>
                  <Text style={s.autoSub} numberOfLines={1}>Match the filters attached to this device</Text>
                </View>
                {selected === '' && <Text style={s.check}>✓</Text>}
              </Pressable>

              {/* GLYPH GRID */}
              <Text style={[s.kicker, { marginTop: 22 }]}>CHOOSE A SYMBOL</Text>
              <View style={s.grid}>
                {CURATED.map(name => {
                  const on = selected === name;
                  return (
                    <Pressable key={name} style={[s.tile, on && s.tileOn]} onPress={() => setSelected(name)}>
                      <SymbolView
                        name={name}
                        type="monochrome"
                        tintColor={t.iconInk}
                        size={26}
                        resizeMode="scaleAspectFit"
                        fallback={<IconOther size={26} color={t.iconInk} />}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    dock: { flex: 1, justifyContent: 'flex-end' },

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
    kicker: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginBottom: 10 },

    autoRow: {
      flexDirection: 'row', alignItems: 'center',
      padding: 13, borderRadius: 10, borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card,
    },
    autoRowOn: { borderColor: t.ink },
    autoIcon: { width: 30, alignItems: 'center', marginRight: 10 },
    autoName: { fontSize: 15, fontWeight: '700', color: t.ink },
    autoSub: { fontSize: 12.5, color: t.muted, marginTop: 2 },
    check: { fontSize: 16, fontWeight: '700', color: t.ink, marginLeft: 8 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: {
      width: 56, height: 56, borderRadius: 12,
      borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card,
      alignItems: 'center', justifyContent: 'center',
    },
    tileOn: { borderColor: t.ink, backgroundColor: t.tabIdleBg },
  });
}