// lib/useFixScrollToTop.js — fix for the iPadOS 26 scroll-to-top-on-return bug.
//
// PROBLEM: On iPad running iPadOS 26, when a screen in a native stack with
// `headerShown: false` is scrolled down and you navigate deeper then come back,
// iOS resets the scroll position to the top. Root cause: iPadOS 26 extended the
// native UIScrollView `scrollsToTop` behavior (the "tap the status bar to jump
// to top" feature) to also fire during navigation transitions. This is a
// platform behavior, confirmed in react-navigation issue #12843, and it is NOT
// reachable/fixable through most RN scroll props — the reset fires a beat after
// focus, unbeatable by JS scroll restoration.
//
// FIX: temporarily disable `scrollsToTop` on the ScrollView during the focus
// transition window, then re-enable it so the legitimate status-bar-tap-to-top
// still works. Returns the value to pass to the ScrollView's `scrollsToTop` prop.
//
// USAGE:
//   const scrollsToTop = useFixScrollToTop();
//   ...
//   <ScrollView scrollsToTop={scrollsToTop}> ... </ScrollView>
//
// Only iPhone is unaffected by the bug, but the hook is harmless there (it just
// briefly disables a feature that behaves identically on re-enable), so screens
// can use it unconditionally.

import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

// Delay (ms) before re-enabling scrollsToTop after focus. Must outlast the
// navigation transition + the late native reset (observed firing up to a few
// hundred ms after focus). 600ms is comfortably past it while still restoring
// the status-bar-tap feature promptly.
const REENABLE_DELAY = 600;

export default function useFixScrollToTop() {
  const [enabled, setEnabled] = useState(false);
  useFocusEffect(
    useCallback(() => {
      const id = setTimeout(() => setEnabled(true), REENABLE_DELAY);
      return () => {
        clearTimeout(id);
        setEnabled(false);
      };
    }, [])
  );
  return enabled;
}