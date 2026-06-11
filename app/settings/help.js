// app/settings/help.js — Help & Tips: how the app works.
//
// Static reference content reachable from Settings (between Backup and About).
// Matches the subscreen layout: BackButton, big title, scrolling body. Sections
// mirror the model — Assets -> Devices -> Filters — then schedule/status, stock,
// icons, manuals, the Settings screens, and a getting-started list.
//
// Auto-routed by expo-router (like About/Backup/Reminders); no Stack.Screen
// entry needed.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import { replayOnboarding } from '../../components/OnboardingModal';

export default function Help() {
  const t = useTheme();
  const s = makeStyles(t);
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>

      <ScrollView style={s.scrollView} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Help & Tips</Text>
        <Text style={s.sub}>How The Filter List works.</Text>

        <Text style={s.h}>The big picture</Text>
        <Text style={s.p}>
          Three layers, nested: <Text style={s.b}>Assets</Text> hold <Text style={s.b}>Devices</Text>, and Devices hold <Text style={s.b}>Filters</Text>.
        </Text>
        <Text style={s.li}><Text style={s.b}>Asset</Text> — a place or thing you group by: your house, a specific car, the office.</Text>
        <Text style={s.li}><Text style={s.b}>Device</Text> — equipment that takes a replaceable filter: a furnace, the fridge, an under-sink RO system, your car's cabin.</Text>
        <Text style={s.li}><Text style={s.b}>Filter</Text> — the actual replaceable part: the cartridge or element you swap on a schedule.</Text>
        <Text style={s.p}>So your House (asset) has a Furnace (device) that uses a MERV 11 (filter).</Text>

        <Text style={s.h}>Devices</Text>
        <Text style={s.p}>
          A device lives under one asset and holds one or more filters, each tracked on its own schedule. A device can
          also have no filters — it still works as a basic item you can mark replaced and keep notes on. Every device
          carries a name, an icon, optional model/serial, a product link, an owner's manual, and notes.
        </Text>

        <Text style={s.h}>Filters</Text>
        <Text style={s.p}>
          The filter is the replaceable part, and it's what drives the schedule. Each filter has a type (Water, Air, or
          Other), an optional SKU and reorder link, an on-hand count with a low-stock threshold, and a replacement
          interval (say, every 90 days). Because the interval lives on the filter, the same filter used by two devices
          keeps the same cadence everywhere.
        </Text>

        <Text style={s.h}>Schedule & status</Text>
        <Text style={s.p}>Each device shows a status from its filters' intervals and when they were last replaced:</Text>
        <View style={s.legend}>
          <View style={s.legendRow}><View style={[s.dot, { backgroundColor: t.status.grn.pillInk }]} /><Text style={s.p0}><Text style={s.b}>Fresh</Text> — plenty of time left</Text></View>
          <View style={s.legendRow}><View style={[s.dot, { backgroundColor: t.status.amb.pillInk }]} /><Text style={s.p0}><Text style={s.b}>Due soon</Text> — replace it shortly</Text></View>
          <View style={s.legendRow}><View style={[s.dot, { backgroundColor: t.status.red.pillInk }]} /><Text style={s.p0}><Text style={s.b}>Overdue</Text> — past its interval</Text></View>
        </View>
        <Text style={s.p}>
          Open a device and tap <Text style={s.b}>Mark Replaced</Text> when you swap a filter to reset its clock. A
          device with several filters tracks each one separately and surfaces the soonest due.
        </Text>

        <Text style={s.h}>Stock & reordering</Text>
        <Text style={s.p}>
          Each filter tracks how many you have on hand against a low-stock threshold. <Text style={s.b}>Settings → Filters</Text> is
          your inventory — it flags what's running low so you can reorder before you're caught short, and a reorder link
          takes you straight to buying it.
        </Text>

        <Text style={s.h}>Icons</Text>
        <Text style={s.p}>
          A device's icon is set automatically from the type of filters attached — water, air, or a generic mark when
          it's mixed or empty. To override, tap the icon on a device and pick a symbol, or leave it on <Text style={s.b}>Auto</Text>.
        </Text>

        <Text style={s.h}>Owner's manuals</Text>
        <Text style={s.p}>
          Attach a web link and/or a file (a PDF from Files, iCloud, OneDrive, etc.) to a device. Files are kept inside
          the app so they open offline.
        </Text>

        <Text style={s.h}>Settings</Text>
        <Text style={s.li}><Text style={s.b}>Assets & Archive</Text> — add, rename, reorder, and archive the things you group by. Archiving hides an asset and its devices without deleting them.</Text>
        <Text style={s.li}><Text style={s.b}>Filters</Text> — your inventory of replaceable parts and their stock.</Text>
        <Text style={s.li}><Text style={s.b}>Reminders</Text> — when the app notifies you about upcoming replacements.</Text>
        <Text style={s.li}><Text style={s.b}>Backup</Text> — export everything to a single .filter file, or restore from one. Worth doing before switching phones.</Text>

        <Text style={s.h}>Getting started</Text>
        <Text style={s.li}>1.  Add your Assets (House, a car, the office).</Text>
        <Text style={s.li}>2.  Add a Device under each.</Text>
        <Text style={s.li}>3.  Attach the Filters it uses, and set each filter's interval.</Text>
        <Text style={s.p}>Keep a low-stock threshold so the inventory warns you in time, and back up before reinstalling.</Text>

        <Text style={s.h}>Welcome tour</Text>
        <Text style={s.p}>Want the intro again? Replay the welcome walkthrough anytime.</Text>
        <Pressable style={s.replayBtn} onPress={replayOnboarding}>
          <Text style={s.replayBtnTxt}>Replay intro</Text>
        </Pressable>

        <View style={{ height: 16 }} />
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

    h: { fontSize: 16, fontWeight: '800', color: t.ink, marginTop: 26, marginBottom: 2, paddingLeft: 16 },
    p: { fontSize: 14.5, color: t.inkSoft, lineHeight: 21, marginTop: 10, paddingLeft: 16, paddingRight: 4 },
    p0: { fontSize: 14.5, color: t.inkSoft, lineHeight: 21, flex: 1 },
    li: { fontSize: 14.5, color: t.inkSoft, lineHeight: 21, marginTop: 9, paddingLeft: 16, paddingRight: 4 },
    b: { fontWeight: '700', color: t.ink },

    legend: { marginTop: 12, paddingLeft: 16, gap: 9 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dot: { width: 10, height: 10, borderRadius: 5 },

    replayBtn: {
      alignSelf: 'flex-start', marginLeft: 16, marginTop: 14,
      paddingVertical: 12, paddingHorizontal: 24,
      borderRadius: 10, backgroundColor: t.tabIdleBg,
      minHeight: 44, alignItems: 'center', justifyContent: 'center',
    },
    replayBtnTxt: { fontSize: 15, fontWeight: '700', color: t.ink },
  });
}