// components/IconPickerModal.js — choose a Device's icon.
//
// iOS SHEET picker (presentationStyle="pageSheet"): the card is inset from the
// top with rounded corners and the form peeks behind it, so it clearly reads as
// a modal — no dim ambiguity, and no competing Save button to confuse with this
// screen's controls.
//
// A sectioned grid of glyph tiles (SF Symbols). Leads with the app's own water
// (SF "humidity") and air (SF "fan") marks, then water / air & climate / home &
// appliances / auto / utility families. Tiles show the glyph only — no cryptic
// symbol names for the user to decode.
//
// NO "AUTO" CHOICE: a device with no icon override already derives its glyph
// from the filters attached to it (see DeviceIcon / deviceDisplayType). So a
// user who never opens this picker, or picks nothing, gets the automatic glyph
// for free. The picker's only job is to SET an explicit symbol.
//
// TAP TO APPLY: tapping any glyph applies it and closes immediately (onSave).
// The header has a single Cancel; there's no separate Done step.
//
// onSave returns the chosen SF Symbol name. expo-symbols is a native module —
// symbols render only in a dev/standalone build, not Expo Go.
//
// TO ADD MORE SYMBOLS: extend a section's `names` in SECTIONS below. Verify
// names in Apple's SF Symbols app — an unknown name renders the generic
// fallback tile (IconOther) instead of the symbol, so prune any tile that shows
// the plain divider glyph on your OS version. Many appliance/auto symbols are
// iOS 17+ (fine on current devices).

import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '../theme/theme';
import { IconOther } from '../theme/Icons';

// Glyph grid, grouped into sections. The first section leads with the app's own
// water/air marks. Sibling-of-verified names (the iOS-17 appliance/home/auto
// family) are used liberally; unknowns fall back to the generic tile.
const SECTIONS = [
  {
    title: 'Suggested',
    names: ['humidity', 'fan', 'drop.fill', 'wind', 'house.fill', 'car.fill'],
  },
  {
    title: 'Water',
    names: [
      'drop', 'drop.fill', 'spigot.fill', 'shower.fill', 'bathtub.fill',
      'sink.fill', 'toilet.fill', 'waterbottle.fill', 'humidity', 'camera.filters',
    ],
  },
  {
    title: 'Air & Climate',
    names: [
      'fan', 'wind', 'air.conditioner.horizontal.fill', 'air.conditioner.vertical.fill',
      'air.purifier.fill', 'humidifier.fill', 'thermometer', 'thermometer.medium',
      'heater.vertical.fill', 'snowflake', 'flame.fill',
    ],
  },
  {
    title: 'Home & Appliances',
    names: [
      'house.fill', 'refrigerator.fill', 'washer.fill', 'dryer.fill', 'dishwasher.fill',
      'oven.fill', 'microwave.fill', 'cooktop.fill', 'lightbulb.fill', 'powerplug.fill',
    ],
  },
  {
    title: 'Auto',
    names: ['car.fill', 'bolt.car.fill', 'fuelpump.fill', 'engine.combustion.fill', 'steeringwheel'],
  },
  {
    title: 'Utility',
    names: [
      'gauge.with.dots.needle.bottom.50percent', 'gearshape.fill', 'wrench.and.screwdriver.fill',
      'bolt.fill', 'leaf.fill', 'line.3.horizontal.decrease', 'sparkles',
    ],
  },
];

export default function IconPickerModal({ visible, value = null, onCancel, onSave }) {
  const t = useTheme();
  const s = makeStyles(t);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <View style={s.head}>
            <View style={s.headSlot}>
              <Pressable onPress={onCancel} hitSlop={10}><Text style={s.cancel}>Cancel</Text></Pressable>
            </View>
            <Text style={s.title}>Choose Icon</Text>
            <View style={[s.headSlot, s.headSlotRight]} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
          >
            {SECTIONS.map(section => (
              <View key={section.title}>
                <Text style={s.kicker}>{section.title.toUpperCase()}</Text>
                <View style={s.grid}>
                  {section.names.map((name, i) => {
                    const on = value === name;
                    return (
                      <Pressable
                        key={section.title + ':' + name + ':' + i}
                        style={[s.tile, on && s.tileOn]}
                        onPress={() => onSave(name)}
                      >
                        <SymbolView
                          name={name}
                          type="monochrome"
                          tintColor={t.iconInk}
                          size={t.ui(28)}
                          resizeMode="scaleAspectFit"
                          fallback={<IconOther size={t.ui(28)} color={t.iconInk} />}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
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
    cancel: { color: t.inkSoft, fontSize: t.uit(16) },
    title: { fontSize: t.uit(16), fontWeight: '700', color: t.ink, textAlign: 'center' },

    scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },

    kicker: { ...t.type.kicker, color: t.muted, textTransform: 'uppercase', marginTop: 24, marginBottom: 12 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: t.ui(14) },
    tile: {
      width: t.ui(60), height: t.ui(60), borderRadius: t.ui(14),
      borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card,
      alignItems: 'center', justifyContent: 'center',
    },
    tileOn: { borderColor: t.ink, backgroundColor: t.tabIdleBg },
  });
}