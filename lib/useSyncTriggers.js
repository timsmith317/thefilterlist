// File: lib/useSyncTriggers.js → ~/Projects/thefilterlist/lib/useSyncTriggers.js
//
// When sync runs, without any screen knowing about it.
//
// Triggers:
//   1. APP BECOMES ACTIVE (and on mount) — the moment another device's changes
//      matter is when you pick this one up.
//   2. AFTER A LOCAL EDIT — in data/store.js saveData, debounced, so a burst of
//      keystrokes produces one sync rather than thirty.
//   3. WHILE THE APP SITS OPEN — a slow interval, foreground only.
//   4. PULL TO REFRESH on the home screen — the manual one, never throttled.
//
// ON (3), because it reverses an earlier decision: I argued against polling on
// the grounds that filters change a few times a year. That's true of the user's
// OWN edits, and it's the wrong measure — the interesting event is a change
// arriving from ANOTHER device, which this device has no way to learn about
// while it just sits on a screen. Testing found exactly that: a device left open
// never noticed the other one's changes, and reaching for pull-to-refresh was
// the instinct.
//
// The interval is foreground-only — it stops the moment the app is
// backgrounded — so the battery objection to background polling doesn't apply.
// Set FOREGROUND_POLL_MS to 0 to turn it off.
//
// Usage — one line in app/_layout.js, inside the root component:
//     useSyncTriggers();

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { syncNow } from './syncClient';

// A guard against the double-fire some Android versions produce when returning
// from a share sheet or a picker: 'active' can arrive twice in quick succession,
// and each one would start a sync (the second joins the first, but it's noise).
const MIN_INTERVAL_MS = 30 * 1000;

// How often to check for another device's changes while the app is open and in
// the foreground. Set to 0 to disable polling entirely.
const FOREGROUND_POLL_MS = 5 * 60 * 1000;

export default function useSyncTriggers() {
  const lastRun = useRef(0);
  const timer = useRef(null);

  useEffect(() => {
    const maybeSync = () => {
      const now = Date.now();
      if (now - lastRun.current < MIN_INTERVAL_MS) return;
      lastRun.current = now;
      // Fire and forget. syncNow resolves with a result object rather than
      // throwing, and nothing here reacts to it — a failed background sync is
      // not the user's problem. The Sync settings screen is where it's visible.
      syncNow().catch(() => {});
    };

    const startPolling = () => {
      if (!FOREGROUND_POLL_MS || timer.current) return;
      timer.current = setInterval(maybeSync, FOREGROUND_POLL_MS);
    };

    const stopPolling = () => {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
    };

    // Sync on mount as well as on foreground: a cold start doesn't emit an
    // AppState change, so without this the first launch of the day wouldn't sync
    // until you switched away and back.
    maybeSync();
    startPolling();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        maybeSync();
        startPolling();
      } else {
        // Stop the moment we're not on screen. An interval left running in the
        // background is the thing that actually costs battery, and it buys
        // nothing — nobody is looking at a stale list they can't see.
        stopPolling();
      }
    });

    return () => { stopPolling(); sub.remove(); };
  }, []);
}
