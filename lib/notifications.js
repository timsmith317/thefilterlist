// lib/notifications.js -> ~/Projects/thefilterlist/lib/notifications.js
//
// Schedules local notifications (iOS + Android) for device due-dates based on
// the user's reminder preferences in settings.reminders.
//
// ANDROID CHANNEL — REQUIRED:
//   Android 8+ discards any notification that doesn't belong to a channel, and
//   it does so SILENTLY: scheduleNotificationAsync still resolves, the
//   notification appears in the scheduled list, and then nothing is ever shown.
//   ensureAndroidChannel() creates ours, and every scheduled trigger carries
//   channelId. It's a no-op on iOS.
//
// Public API:
//   ensurePermissions()         -> { granted, canAsk, status }
//   openAppNotificationSettings()
//   syncDeviceNotifications(d)  -> { scheduled, candidates, truncated, noPermission, disabled }
//   cancelAllDeviceNotifications()
//
// Internal identifier scheme:
//   notif_device_<deviceId>_<daysBefore>
// Deterministic IDs mean we can cancel/reschedule cleanly without storing
// per-device notification IDs in the data model.
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

// content.sound is iOS-only. On iOS 'default' means the system sound; on
// Android any string is read as a custom sound FILENAME, which errors if that
// file isn't bundled. Android takes its sound from the channel instead.
const CONTENT_SOUND = Platform.OS === 'ios' ? 'default' : undefined;

const NOTIF_PREFIX = 'fl_filter_';
const MAX_SCHEDULED = 60;

// Android notification channel. The id is persisted by the OS — once created,
// the user owns its sound/importance settings, and changing them here has no
// effect on an existing install. Bump the id (e.g. 'reminders-v2') if the
// defaults ever genuinely need to change.
// IMPORTANT: Android freezes a channel's settings the moment it's created —
// importance, sound and vibration then belong to the user, and editing the code
// above does nothing on a device that already has the channel. Bumping this id
// creates a fresh channel with the new defaults. (Uninstalling also clears it.)
export const ANDROID_CHANNEL_ID = 'reminders-v2';

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Filter reminders',
      description: 'Alerts when a filter is due for replacement.',
      // HIGH = heads-up banner over the current screen. DEFAULT only posts
      // silently to the notification shade, which reads as "nothing happened".
      importance: Notifications.AndroidImportance.HIGH,
      // NOTE: no `sound` key. On Android this field names a CUSTOM sound file
      // bundled via the expo-notifications plugin; the string 'default' makes it
      // search for a file called "default" and fail. Omitting it = system default.
      enableVibrate: true,
    });
  } catch (e) {
    console.warn('ensureAndroidChannel failed:', e);
  }
}

function notifId(deviceId, daysBefore) {
  return `${NOTIF_PREFIX}${deviceId}_${daysBefore}`;
}

// ----- Permissions -----

export async function ensurePermissions() {
  // Channel must exist before anything is delivered on Android. Creating it
  // here (and again in syncDeviceNotifications) is cheap and idempotent.
  await ensureAndroidChannel();
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

export async function cancelAllDeviceNotifications() {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const ours = all.filter(n => (n.identifier || '').startsWith(NOTIF_PREFIX));
    for (const n of ours) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  } catch (e) {
    console.warn('cancelAllDeviceNotifications failed:', e);
  }
}

// ----- Date computation -----

function computeNotificationDate(device, daysBefore, timeOfDay) {
  const status = statusOf(device);
  if (!status || !status.due) return null;
  const target = new Date(status.due);
  target.setDate(target.getDate() - daysBefore);
  const [h, m] = (timeOfDay || '09:00').split(':').map(n => parseInt(n, 10));
  target.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return target;
}

// ----- Notification text -----

function buildTitle(device, daysBefore, asset) {
  const assetFilter = asset && asset.name ? ` (${asset.name})` : '';
  if (daysBefore <= 0) return `${device.name}${assetFilter} due today`;
  if (daysBefore === 1) return `${device.name}${assetFilter} due tomorrow`;
  return `${device.name}${assetFilter} due in ${daysBefore} days`;
}

function buildBody(device, daysBefore) {
  if (daysBefore <= 1) return 'Time to replace. Tap to mark complete.';
  if (daysBefore <= 7) return 'Replacement coming up. Tap to view.';
  return 'Time to order a replacement.';
}

// ----- Main sync -----

export async function syncDeviceNotifications(data) {
  // Always start by clearing our existing scheduled notifications. This is
  // idempotent so it's safe to call this on every save.
  await cancelAllDeviceNotifications();
  await ensureAndroidChannel();

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
  const devices = data.devices || [];

  for (const device of devices) {
    const asset = (data.assets || []).find(a => a.id === device.assetId);
    if (asset && asset.archived) continue; // archived assets shouldn't notify
    for (const daysBefore of allDays) {
      const date = computeNotificationDate(device, daysBefore, reminders.timeOfDay);
      if (!date || date <= now) continue;
      candidates.push({
        id: notifId(device.id, daysBefore),
        date,
        title: buildTitle(device, daysBefore, asset),
        body: buildBody(device, daysBefore),
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
        content: { title: c.title, body: c.body, sound: CONTENT_SOUND },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: c.date,
          // Ignored on iOS; required on Android or the OS drops the delivery.
          channelId: ANDROID_CHANNEL_ID,
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
// ----- Test helpers (safe to keep; nothing calls them in normal flow) -----

// Fires a real notification a few seconds from now, using the same channel and
// permission path as the real ones. The fastest way to prove the whole chain —
// permission, channel, scheduling, delivery — actually works end to end.
//
// Background the app after calling: on both platforms a foreground notification
// is handled by setNotificationHandler above rather than shown by the OS.
export async function scheduleTestNotification(seconds = 15) {
  await ensureAndroidChannel();
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) {
    console.warn('[notif-test] permission NOT granted — nothing scheduled');
    return { ok: false, reason: 'no-permission' };
  }
  // Unique id per run, and a prefix OUTSIDE NOTIF_PREFIX. A fixed id made each
  // test replace the previous one, and sharing the fl_filter_ prefix meant
  // cancelAllDeviceNotifications() (which runs on every save) silently killed
  // pending tests before they fired.
  const stamp = new Date().toLocaleTimeString();
  await Notifications.scheduleNotificationAsync({
    identifier: `fl_test_${Date.now()}`,
    content: {
      title: 'Test reminder',
      body: `Requested at ${stamp} — fired ${seconds}s later.`,
      sound: CONTENT_SOUND,
    },
    // DATE trigger, not TIME_INTERVAL — this is the same trigger type real
    // reminders use, so a successful test exercises the identical delivery path
    // rather than a similar one.
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + seconds * 1000),
      channelId: ANDROID_CHANNEL_ID,
    },
  });
  console.log(`[notif-test] scheduled at ${stamp} — background the app, expect it in ${seconds}s`);
  return { ok: true, requestedAt: stamp };
}

// Dumps everything currently queued. Useful when a reminder doesn't arrive:
// entries listed here mean scheduling worked and the problem is delivery
// (channel or OS-level block); an empty list means scheduling never happened.
export async function debugDumpScheduled() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  console.log(`[notif-debug] ${all.length} scheduled`);
  all.forEach(n => {
    const when = n.trigger?.date ? new Date(n.trigger.date).toLocaleString() : JSON.stringify(n.trigger);
    console.log(`  ${n.identifier} -> ${when}`);
  });
  return all;
}
