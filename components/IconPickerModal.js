// components/IconPickerModal.js → ~/Projects/thefilterlist/components/IconPickerModal.js
//
// Choose a Device's icon.
//
// iOS SHEET picker (presentationStyle="pageSheet"): the card is inset from the
// top with rounded corners and the form peeks behind it, so it clearly reads as
// a modal — no dim ambiguity, and no competing Save button.
//
// A sectioned grid of glyph tiles. CROSS-PLATFORM: every glyph is Material
// Design Icons (Apache 2.0) rendered through react-native-svg, plus our own
// custom 'water-layers' mark. No SF Symbols — they're Apple-platform-only and
// rendered blank on Android.
//
// NO "AUTO" CHOICE: a device with no icon override already derives its glyph
// from the filters attached to it (see DeviceIcon / deviceDisplayType). So a
// user who never opens this picker gets the automatic glyph for free. This
// picker's only job is to SET an explicit icon.
//
// TAP TO APPLY: tapping any glyph applies it and closes immediately (onSave).
// The header has a single Cancel; there's no separate Done step.
//
// onSave returns the icon NAME string (e.g. 'fridge', 'water-layers'), stored
// on the device as `icon`. Legacy SF names saved by older iOS builds are
// translated at render time by DeviceIcon — see theme/iconPaths.js.
//
// TO ADD MORE ICONS: add the path to ICON_PATHS in theme/iconPaths.js, then add
// its name to a section below. Browse the full 7,000+ set at
// https://pictogrammers.com/library/mdi/

import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';
import { MdiIcon, IconWater, IconOther } from '../theme/Icons';

// Glyph grid, grouped into sections. The first section leads with the app's own
// water/air marks. Sibling-of-verified names (the iOS-17 appliance/home/auto
// family) are used liberally; unknowns fall back to the generic tile.
const SECTIONS = [
  {
    title: 'Suggested',
    names: ['water-layers', 'fan', 'filter-variant', 'home', 'office-building', 'car'],
  },
  {
    title: 'Water',
    names: [
      'water', 'water-outline', 'water-percent', 'water-pump', 'shower',
      'bathtub', 'faucet', 'toilet', 'bottle-tonic', 'filter',
    ],
  },
  {
    title: 'Air & Climate',
    names: [
      'fan', 'weather-windy', 'air-conditioner', 'hvac', 'air-purifier',
      'air-humidifier', 'thermometer', 'thermometer-lines', 'radiator',
      'snowflake', 'fire',
    ],
  },
  {
    title: 'Home & Places',
    names: [
      'home', 'office-building', 'fridge', 'washing-machine', 'tumble-dryer',
      'dishwasher', 'toaster-oven', 'microwave', 'stove', 'lightbulb', 'power-plug',
    ],
  },
  {
    title: 'Auto',
    names: ['car', 'car-electric', 'gas-station', 'engine', 'steering'],
  },
  {
    title: 'Utility',
    names: [
      'gauge', 'cog', 'tools', 'lightning-bolt', 'leaf', 'filter-variant', 'auto-fix',
    ],
  },
];

// 'water-layers' is our custom glyph rather than an MDI path, so it needs its
// own component. Everything else is a straight MDI lookup.
function GlyphTile({ name, size, color }) {
  if (name === 'water-layers') return <IconWater size={size} color={color} />;
  return <MdiIcon name={name} size={size} color={color} />;
}


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
                        <GlyphTile name={name} size={t.ui(28)} color={t.iconInk} />
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
