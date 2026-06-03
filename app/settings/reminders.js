// app/settings/reminders.js
//
// Settings → Reminders. Master toggle, notification time, First Reminder,
// and (one) Additional Reminder. All changes save live; saveData() (in
// data/store) re-syncs scheduled notifications after each write.
//
// extraReminders is kept as an array (length 0 or 1 in this UI) so the data
// shape can support multiple later without a migration.

import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../theme/theme';
import { BackButton } from '../../components/HeaderBits';
import PickerSheet from '../../components/PickerSheet';
import TimePickerModal from '../../components/TimePickerModal';
import { loadData, saveData, updateReminders } from '../../data/store';
import {
  ensurePermissions, getPermissionStatus, openAppNotificationSettings,
} from '../../lib/notifications';

const DAY_OPTIONS = [
  { id: '1',  name: '1 day',   value: 1 },
  { id: '3',  name: '3 days',  value: 3 },
  { id: '7',  name: '7 days',  value: 7 },
  { id: '14', name: '14 days', value: 14 },
  { id: '30', name: '30 days', value: 30 },
  { id: '60', name: '60 days', value: 60 },
  { id: '90', name: '90 days', value: 90 },
];

function formatTime12(hhmm) {
  if (!hhmm) return '9:00 AM';
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function dayLabel(n) {
  return n === 1 ? '1 day' : `${n} days`;
}

export default function RemindersSettings() {
  const t = useTheme();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [perm, setPerm] = useState({ granted: false, canAsk: true });
  const [timeOpen, setTimeOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);

  // Reload data + permission status on focus
  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([loadData(), getPermissionStatus()]).then(([d, p]) => {
      if (active) { setData(d); setPerm(p); }
    });
    return () => { active = false; };
  }, []));

  const s = makeStyles(t);
  if (!data) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const r = data.settings.reminders;
  const enabled = !!r.enabled;
  const leadDays = r.leadDays;
  const timeOfDay = r.timeOfDay || '09:00';

  // Only the first element of extraReminders is surfaced. If the data has
  // more (legacy), they're ignored by the UI; the scheduler still sees them
  // until the user picks a new value, but migrateReminders in store.js
  // clamps to length-1 on load so this case effectively can't happen here.
  const extras = Array.isArray(r.extraReminders) ? r.extraReminders : [];
  const additional = extras.length > 0 ? extras[0] : null;

  const persist = async (patch) => {
    const next = updateReminders(data, patch);
    setData(next);
    await saveData(next); // saveData triggers notification sync
  };

  const onToggleEnabled = async (next) => {
    if (next === true) {
      const result = await ensurePermissions();
      setPerm({ granted: result.granted, canAsk: result.canAsk });
      // Still persist enabled=true even if denied — banner will guide user
      // to Settings. Sync skips scheduling if not granted.
    }
    persist({ enabled: next });
  };

  // First Reminder pick — replaces leadDays.
  const onPickLead = (id) => {
    const opt = DAY_OPTIONS.find(o => o.id === id);
    if (opt) persist({ leadDays: opt.value });
    setLeadOpen(false);
  };

  // Additional Reminder pick — replaces the single extra value.
  const onPickExtra = (id) => {
    const opt = DAY_OPTIONS.find(o => o.id === id);
    if (opt) persist({ extraReminders: [opt.value] });
    setExtraOpen(false);
  };

  const onClearExtra = () => {
    persist({ extraReminders: [] });
    setExtraOpen(false);
  };

  // Lead-time picker items — full list (the leadDays value can be re-chosen).
  const leadItems = DAY_OPTIONS;

  // Additional-reminder picker items — exclude whatever leadDays is so the
  // two rows can't end up the same value (which would just dedupe to one
  // scheduled notification anyway, but is confusing visually).
  const extraItems = DAY_OPTIONS.filter(o => o.value !== leadDays);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <BackButton onPress={() => router.back()} />
        <View />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        <Text style={s.title}>Reminders</Text>
        <Text style={s.sub}>Get notified before filters are due.</Text>

        {/* Permission banner if reminders are on but iOS notifications are off */}
        {enabled && !perm.granted && (
          <View style={s.banner}>
            <Text style={s.bannerTitle}>Notifications disabled</Text>
            <Text style={s.bannerBody}>
              Reminders are on, but iOS notifications are off for this app.
              Enable them in Settings to start receiving alerts.
            </Text>
            <Pressable style={s.bannerBtn} onPress={openAppNotificationSettings}>
              <Text style={s.bannerBtnTxt}>Open iOS Settings</Text>
            </Pressable>
          </View>
        )}

        {/* Master toggle */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Reminders enabled</Text>
            <Text style={s.toggleSub}>
              {enabled ? 'Reminders will be sent.' : 'No reminders will be sent.'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggleEnabled}
            trackColor={{ true: '#15803d', false: t.line }}
          />
        </View>

        {/* Notification time */}
        <Text style={s.label}>NOTIFICATION TIME</Text>
        <Pressable style={s.row} onPress={() => setTimeOpen(true)} disabled={!enabled}>
          <Text style={[s.rowValue, !enabled && s.rowDim]}>{formatTime12(timeOfDay)}</Text>
          <Text style={[s.chev, !enabled && s.rowDim]}>{'\u203A'}</Text>
        </Pressable>

        {/* First reminder lead time */}
        <Text style={s.label}>FIRST REMINDER</Text>
        <Pressable style={s.row} onPress={() => setLeadOpen(true)} disabled={!enabled}>
          <Text style={[s.rowValue, !enabled && s.rowDim]}>
            {dayLabel(leadDays)} before due
          </Text>
          <Text style={[s.chev, !enabled && s.rowDim]}>{'\u203A'}</Text>
        </Pressable>

        {/* Additional reminder — single row (matches First Reminder style) */}
        <Text style={s.label}>ADDITIONAL REMINDER</Text>
        <Pressable style={s.row} onPress={() => setExtraOpen(true)} disabled={!enabled}>
          <Text style={[s.rowValue, !additional && s.rowPlaceholder, !enabled && s.rowDim]}>
            {additional ? `${dayLabel(additional)} before due` : 'None'}
          </Text>
          <Text style={[s.chev, !enabled && s.rowDim]}>{'\u203A'}</Text>
        </Pressable>
      </ScrollView>

      <TimePickerModal
        visible={timeOpen}
        initialTime={timeOfDay}
        title="Notification Time"
        onCancel={() => setTimeOpen(false)}
        onConfirm={(hhmm) => { persist({ timeOfDay: hhmm }); setTimeOpen(false); }}
      />

      <PickerSheet
        visible={leadOpen}
        title="First Reminder"
        items={leadItems}
        selectedId={String(leadDays)}
        onSelect={onPickLead}
        onCancel={() => setLeadOpen(false)}
        searchPlaceholder="Search..."
        emptyText="No options."
      />

      <PickerSheet
        visible={extraOpen}
        title="Additional Reminder"
        items={extraItems}
        selectedId={additional != null ? String(additional) : null}
        onSelect={onPickExtra}
        onSelectNone={onClearExtra}
        noneLabel="None"
        onCancel={() => setExtraOpen(false)}
        searchPlaceholder="Search..."
        emptyText="No options available."
      />
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

    title: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5, color: t.ink, marginTop: 4, paddingLeft: 16 },
    sub: { fontSize: 13, color: t.muted, marginTop: 4, paddingLeft: 16 },

    banner: {
      marginTop: 18, padding: 14, borderRadius: 12,
      backgroundColor: t.status.amb.pillBg, borderWidth: 1, borderColor: t.line,
    },
    bannerTitle: { fontSize: 14, fontWeight: '700', color: t.status.amb.pillInk, marginBottom: 4 },
    bannerBody:  { fontSize: 13, color: t.ink, lineHeight: 18 },
    bannerBtn:   { marginTop: 10, alignSelf: 'flex-start', backgroundColor: t.bg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: t.line },
    bannerBtnTxt:{ fontSize: 13, fontWeight: '700', color: t.ink },

    toggleRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 14, paddingHorizontal: 16, marginTop: 22,
      backgroundColor: t.card, borderRadius: 10, borderWidth: 1, borderColor: t.line,
    },
    toggleLabel: { fontSize: 15, fontWeight: '700', color: t.ink },
    toggleSub: { fontSize: 12, color: t.muted, marginTop: 2 },

    label: {
      ...t.type.kicker, color: t.muted, textTransform: 'uppercase',
      marginTop: 22, marginBottom: 8, paddingLeft: 13,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 13, paddingVertical: 13, borderRadius: 10,
      borderWidth: 1.5, borderColor: t.line, backgroundColor: t.card,
    },
    rowValue: { fontSize: 16, color: t.ink },
    rowPlaceholder: { color: t.muted },
    rowDim: { opacity: 0.5 },
    chev: { fontSize: 22, color: t.muted },

    hint: { fontSize: 12, color: t.muted, marginTop: 8, paddingLeft: 13 },
  });
}