// app/settings/help.js — Help & Tips: how the app works.
//
// Independent accordion: every section opens and closes on its own. Tapping a
// header toggles only that section — nothing else opens or closes — so you can
// have as many open at once as you like. The page loads with everything closed.
//
// Because a tap only collapses that section's OWN body (which sits below its
// header), the header you're touching never moves and content above it never
// shifts. That's what makes it feel natural — no forced single-open, no
// driven scrolling, no moving target.
//
// Sections mirror the model — How it works -> Devices -> Filters -> Schedule &
// status -> Stock -> Getting started — then a "Welcome Tour" card as
// the last row in the stack (same chrome as the sections, but a tap-action
// with a static right-pointing chevron, like a Settings hub row).
//
// Auto-routed by expo-router (like About/Backup/Reminders); no Stack.Screen
// entry needed.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import { replayOnboarding } from '../../components/OnboardingModal';

// LayoutAnimation needs this opt-in on Android (no-op/harmless on iOS).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Gentle expand/collapse for the section bodies.
const EXPAND_ANIM = {
  duration: 220,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
};

// A small "shock absorber" of empty space below the content. A scroll view
// won't show blank space past its content, so when you collapse a section and
// the page becomes shorter than your scroll position, it would otherwise drag
// the page up to compensate — the jump. This keeps the page just long enough to
// absorb a collapse so the top stays put and the items below slide up instead.
// It only needs to cover the tallest single section body (~one section), not a
// whole screen — so the leftover space at the very bottom is minimal. Raise it
// if a collapse ever nudges; lower it to trim the cushion further.
const TAIL_SPACE = 280;

// ----- One accordion section: tappable head + collapsible body. -----
// The chevron rotates 90° (points down) while open, animated on the native
// driver independently of the LayoutAnimation that drives the height change.
function Section({ s, title, desc, open, onToggle, children }) {
  const rot = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(rot, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [open]);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={s.card}>
      <Pressable style={s.headRow} onPress={onToggle} hitSlop={6}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.headTitle}>{title}</Text>
          <Text style={s.headDesc}>{desc}</Text>
        </View>
        <Animated.Text style={[s.chev, { transform: [{ rotate }] }]}>{'\u203A'}</Animated.Text>
      </Pressable>
      {open && <View style={s.body}>{children}</View>}
    </View>
  );
}

export default function Help() {
  const t = useTheme();
  const s = makeStyles(t);
  const router = useRouter();

  // Map of open sections by id. Starts empty — everything closed.
  const [openMap, setOpenMap] = useState({});

  const toggle = (id) => {
    LayoutAnimation.configureNext(EXPAND_ANIM);
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>

      <ScrollView style={s.scrollView} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Help & Tips</Text>
        <Text style={s.sub}>How The Filter List works.</Text>
        <View style={s.listTop} />

        <Section s={s} title="How It Works" desc="Assets, devices, and filters" open={!!openMap.how} onToggle={() => toggle('how')}>
          <Text style={s.p0}>Three layers, nested: <Text style={s.b}>Assets</Text> hold <Text style={s.b}>Devices</Text>, and Devices hold <Text style={s.b}>Filters</Text>.</Text>
          <Text style={s.li}><Text style={s.b}>Asset</Text> — a place or thing you group by: your house, a specific car, the office.</Text>
          <Text style={s.li}><Text style={s.b}>Device</Text> — equipment that takes a replaceable filter: a furnace, the fridge, an under-sink RO system, your car's cabin.</Text>
          <Text style={s.li}><Text style={s.b}>Filter</Text> — the actual replaceable part: the cartridge or element you swap on a schedule.</Text>
          <Text style={s.p}>So your House (asset) has a Furnace (device) that uses a MERV 11 (filter).</Text>
        </Section>

        <Section s={s} title="Devices" desc="Name, icon, model, manuals, notes" open={!!openMap.devices} onToggle={() => toggle('devices')}>
          <Text style={s.p0}>A device lives under one asset and holds one or more filters, each tracked on its own schedule. A device can also have no filters — it still works as a basic item you can mark replaced and keep notes on. Every device carries a name, an icon, optional model/serial, a product link, an owner's manual, and notes.</Text>
          <Text style={s.p}><Text style={s.b}>Icons</Text> set automatically from the type of filters attached — water, air, or a generic mark when it's mixed or empty. To override, tap the icon on a device and pick a symbol, or leave it on Auto.</Text>
          <Text style={s.p}><Text style={s.b}>Owner's manuals</Text> — attach a web link and/or a file (a PDF from Files, iCloud, OneDrive, etc.). Files are kept inside the app so they open offline.</Text>
        </Section>

        <Section s={s} title="Filters" desc="Types, intervals, shared schedules" open={!!openMap.filters} onToggle={() => toggle('filters')}>
          <Text style={s.p0}>The filter is the replaceable part, and it's what drives the schedule. Each filter has a type (Water, Air, or Other), an optional SKU and reorder link, an on-hand count with a low-stock threshold, and a replacement interval (say, every 90 days). Because the interval lives on the filter, the same filter used by two devices keeps the same cadence everywhere.</Text>
        </Section>

        <Section s={s} title="Schedule & Status" desc="Fresh, due soon, overdue" open={!!openMap.status} onToggle={() => toggle('status')}>
          <Text style={s.p0}>Each device shows a status from its filters' intervals and when they were last replaced:</Text>
          <View style={s.legend}>
            <View style={s.legendRow}><View style={[s.dot, { backgroundColor: t.status.grn.pillInk }]} /><Text style={s.legendTxt}><Text style={s.b}>Fresh</Text> — plenty of time left</Text></View>
            <View style={s.legendRow}><View style={[s.dot, { backgroundColor: t.status.amb.pillInk }]} /><Text style={s.legendTxt}><Text style={s.b}>Due soon</Text> — replace it shortly</Text></View>
            <View style={s.legendRow}><View style={[s.dot, { backgroundColor: t.status.red.pillInk }]} /><Text style={s.legendTxt}><Text style={s.b}>Overdue</Text> — past its interval</Text></View>
          </View>
          <Text style={s.p}>Open a device and tap <Text style={s.b}>Mark Replaced</Text> when you swap a filter to reset its clock. A device with several filters tracks each one separately and surfaces the soonest due.</Text>
        </Section>

        <Section s={s} title="Stock & Reordering" desc="On-hand counts, low-stock alerts" open={!!openMap.stock} onToggle={() => toggle('stock')}>
          <Text style={s.p0}>Each filter tracks how many you have on hand against a low-stock threshold. <Text style={s.b}>Settings → Filters</Text> is your inventory — it flags what's running low so you can reorder before you're caught short, and a reorder link takes you straight to buying it.</Text>
        </Section>

        <Section s={s} title="Getting Started" desc="Three steps to set up" open={!!openMap.start} onToggle={() => toggle('start')}>
          <Text style={s.li0}>1.  Add your Assets (House, a car, the office).</Text>
          <Text style={s.li}>2.  Add a Device under each.</Text>
          <Text style={s.li}>3.  Attach the Filters it uses, and set each filter's interval.</Text>
          <Text style={s.p}>Keep a low-stock threshold so the inventory warns you in time, and back up before reinstalling.</Text>
        </Section>

        {/* Replay tour — last card in the stack. Same anatomy as the
            sections (title / desc / chevron) but it's a tap-action, not an
            accordion: the chevron stays pointing right, like a Settings row. */}
        <Pressable
          style={({ pressed }) => [s.card, s.replayRow, pressed && s.replayPressed]}
          onPress={replayOnboarding}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.headTitle}>Welcome Tour</Text>
            <Text style={s.headDesc}>Watch the intro again</Text>
          </View>
          <Text style={s.chev}>{'\u203A'}</Text>
        </Pressable>

        {/* Small cushion so a collapse never has to jump the scroll up. */}
        <View style={{ height: TAIL_SPACE }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6,
    },
    scrollView: { flex: 1 },
    scroll: { paddingHorizontal: 18, paddingBottom: 40 },

    title: { ...t.type.screenTitle, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16, lineHeight: 18 },
    listTop: { height: 18 },

    // Each section is a bordered card; overflow hidden so the body's top
    // divider and the card's rounded corners clip together when expanded.
    card: {
      borderWidth: 1.5, borderColor: t.line, borderRadius: 12,
      backgroundColor: t.card, marginBottom: 8, overflow: 'hidden',
    },
    headRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    headTitle: { fontSize: 16, fontWeight: '700', color: t.ink },
    headDesc: { fontSize: 13, color: t.muted, marginTop: 3 },
    chev: { fontSize: 22, color: t.muted, paddingLeft: 8 },

    body: {
      paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line,
    },
    // p0 / li0 = first element in a body (no top margin). p / li add spacing.
    p0: { fontSize: 14.5, color: t.inkSoft, lineHeight: 21 },
    p: { fontSize: 14.5, color: t.inkSoft, lineHeight: 21, marginTop: 10 },
    li0: { fontSize: 14.5, color: t.inkSoft, lineHeight: 21 },
    li: { fontSize: 14.5, color: t.inkSoft, lineHeight: 21, marginTop: 9 },
    b: { fontWeight: '700', color: t.ink },

    legend: { marginTop: 12, gap: 9 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    legendTxt: { fontSize: 14.5, color: t.inkSoft, lineHeight: 21, flex: 1 },
    dot: { width: 10, height: 10, borderRadius: 5 },

    // Replay tour card — same paddings as a section headRow, flattened
    // onto the card since there's no collapsible body. Pressed state
    // matches the Settings hub rows.
    replayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    replayPressed: { backgroundColor: t.tabIdleBg },
  });
}
