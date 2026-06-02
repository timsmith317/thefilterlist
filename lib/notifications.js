// lib/notifications.js
//
// Schedules local iOS notifications for filter due-dates based on the user's
// reminder preferences in settings.reminders.
//
// Public API:
//   ensurePermissions()         -> { granted, canAsk, status }
//   openAppNotificationSettings()
//   syncFilterNotifications(d)  -> { scheduled, candidates, truncated, noPermission, disabled }
//   cancelAllFilterNotifications()
//
// Internal identifier scheme:
//   notif_filter_<filterId>_<daysBefore>
// Deterministic IDs mean we can cancel/reschedule cleanly without storing
// per-filter notification IDs in the data model.
//
// iOS limit note: iOS allows ~64 pending local notifications per app. We
// schedule up to MAX_SCHEDULED (60, leaving headroom for low-stock alerts
// later). Candidates are sorted by trigger time (soonest first) and any
// overflow is dropped. The return value flags `truncated: true` when this
// happens.

import * as Notifications from 'expo-notifications';
import { Platform, Linking } from 'react-native';
import { statusOf } from '../data/store';

// Show notifications when app is foregrounded too.
// Newer expo-notifications API uses shouldShowBanner/shouldShowList; older
// uses shouldShowAlert. Including both for SDK compatibility.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const NOTIF_PREFIX = 'fl_filter_';
const MAX_SCHEDULED = 60;

function notifId(filterId, daysBefore) {
  return `${NOTIF_PREFIX}${filterId}_${daysBefore}`;
}

// ----- Permissions -----

export async function ensurePermissions() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return { granted: true, canAsk: true, status: existing.status };
  }
  if (!existing.canAskAgain) {
    return { granted: false, canAsk: false, status: existing.status };
  }
  const res = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return { granted: res.granted, canAsk: res.canAskAgain, status: res.status };
}

export async function getPermissionStatus() {
  const p = await Notifications.getPermissionsAsync();
  return { granted: p.granted, canAsk: p.canAskAgain, status: p.status };
}

export function openAppNotificationSettings() {
  // On iOS this opens the app's own Settings page where the user can flip
  // the notification toggle. On Android, opens app info.
  Linking.openSettings();
}

// ----- Cancel -----

export async function cancelAllFilterNotifications() {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const ours = all.filter(n => (n.identifier || '').startsWith(NOTIF_PREFIX));
    for (const n of ours) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  } catch (e) {
    console.warn('cancelAllFilterNotifications failed:', e);
  }
}

// ----- Date computation -----

function computeNotificationDate(filter, daysBefore, timeOfDay) {
  const status = statusOf(filter);
  if (!status || !status.due) return null;
  const target = new Date(status.due);
  target.setDate(target.getDate() - daysBefore);
  const [h, m] = (timeOfDay || '09:00').split(':').map(n => parseInt(n, 10));
  target.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return target;
}

// ----- Notification text -----

function buildTitle(filter, daysBefore, asset) {
  const assetPart = asset && asset.name ? ` (${asset.name})` : '';
  if (daysBefore <= 0) return `${filter.name}${assetPart} due today`;
  if (daysBefore === 1) return `${filter.name}${assetPart} due tomorrow`;
  return `${filter.name}${assetPart} due in ${daysBefore} days`;
}

function buildBody(filter, daysBefore) {
  if (daysBefore <= 1) return 'Time to replace. Tap to mark complete.';
  if (daysBefore <= 7) return 'Replacement coming up. Tap to view.';
  return 'Time to order a replacement.';
}

// ----- Main sync -----

export async function syncFilterNotifications(data) {
  // Always start by clearing our existing scheduled notifications. This is
  // idempotent so it's safe to call this on every save.
  await cancelAllFilterNotifications();

  const reminders = data && data.settings && data.settings.reminders;
  if (!reminders || !reminders.enabled) {
    return { scheduled: 0, candidates: 0, truncated: false, disabled: true };
  }

  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) {
    return { scheduled: 0, candidates: 0, truncated: false, noPermission: true };
  }

  // Deduplicate days-before values so a user adding 7 to extras when 7 is
  // also lead doesn't double-schedule.
  const allDays = Array.from(new Set([
    reminders.leadDays,
    ...(reminders.extraReminders || []),
  ].filter(d => typeof d === 'number' && d >= 0)));

  const now = new Date();
  const candidates = [];
  const filters = data.filters || [];

  for (const filter of filters) {
    const asset = (data.assets || []).find(a => a.id === filter.assetId);
    for (const daysBefore of allDays) {
      const date = computeNotificationDate(filter, daysBefore, reminders.timeOfDay);
      if (!date || date <= now) continue;
      candidates.push({
        id: notifId(filter.id, daysBefore),
        date,
        title: buildTitle(filter, daysBefore, asset),
        body: buildBody(filter, daysBefore),
      });
    }
  }

  // Schedule soonest-first; iOS cap at 64, we use 60 to leave headroom.
  candidates.sort((a, b) => a.date - b.date);
  const truncated = candidates.length > MAX_SCHEDULED;
  const toSchedule = candidates.slice(0, MAX_SCHEDULED);

  let scheduled = 0;
  for (const c of toSchedule) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: c.id,
        content: { title: c.title, body: c.body, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: c.date,
        },
      });
      scheduled++;
    } catch (e) {
      console.warn('schedule failed for', c.id, e);
    }
  }

  return {
    scheduled,
    candidates: candidates.length,
    truncated,
    disabled: false,
  };
}