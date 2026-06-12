// theme.js — single source of truth for The Filter List's look.
// Theme-aware: light + dark palettes, switched by the system color scheme
// OR by an explicit user choice (Settings → Appearance).
// Every screen pulls from useTheme(); nothing hardcodes a color.
// Font is the system font for now (clean, zero-setup); swap to Inter later
// by changing `fontFamily` here only.

import { useState, useEffect } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ----- Theme mode (user override) -----
// 'system' = follow the OS (default), 'light' / 'dark' = forced.
// We lean on Appearance.setColorScheme(): it overrides what useColorScheme()
// returns app-wide, so useTheme() below — and every screen — picks up the
// forced mode with zero per-screen changes. Passing null restores "follow
// the system." The choice persists in its own AsyncStorage key, separate
// from the data store (thefilterlist.data.v5 untouched).
const MODE_KEY = 'thefilterlist.themeMode.v1';
const VALID_MODES = ['system', 'light', 'dark'];

// Module-level cache so useThemeMode() can initialize synchronously after
// the launch read completes (it resolves within milliseconds of startup,
// long before Settings can be opened).
let cachedMode = 'system';

// Apply the saved override at app launch. theme.js is imported by every
// screen, so this top-level read runs once when the bundle loads. There is
// a sub-second window on cold launch where the system theme shows before
// the override lands — accepted tradeoff, not worth gating the splash on.
AsyncStorage.getItem(MODE_KEY)
  .then((v) => {
    if (VALID_MODES.includes(v)) {
      cachedMode = v;
      if (v !== 'system') Appearance.setColorScheme(v);
    }
  })
  .catch(() => {});

// Hook for the Settings toggle: const [mode, setMode] = useThemeMode();
// setMode('light' | 'dark' | 'system') applies instantly and persists.
export function useThemeMode() {
  const [mode, setModeState] = useState(cachedMode);

  // Belt-and-suspenders re-sync in case this mounts before the launch
  // read resolved (effectively never in practice).
  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then((v) => { if (VALID_MODES.includes(v)) setModeState(v); })
      .catch(() => {});
  }, []);

  const setMode = (next) => {
    if (!VALID_MODES.includes(next)) return;
    cachedMode = next;
    setModeState(next);
    Appearance.setColorScheme(next === 'system' ? null : next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  };

  return [mode, setMode];
}

// ----- Status tones (urgency) for both themes -----
const STATUS = {
  light: {
    red:  { pillBg: '#fee2e2', pillInk: '#dc2626' },
    amb:  { pillBg: '#fef3c7', pillInk: '#b45309' },
    grn:  { pillBg: '#dcfce7', pillInk: '#15803d' },
  },
  dark: {
    // Darker, desaturated fills with brighter ink so they pop without glaring
    red:  { pillBg: '#3a1d1d', pillInk: '#f87171' },
    amb:  { pillBg: '#3a2e12', pillInk: '#fbbf24' },
    grn:  { pillBg: '#16301f', pillInk: '#4ade80' },
  },
};

const LIGHT = {
  mode: 'light',
  bg: '#ffffff',
  canvas: '#f6f8fa',
  card: '#ffffff',
  line: '#e8edf3',
  ink: '#0f172a',          // near-black — primary text & accents
  inkSoft: '#475569',      // secondary text (Cancel, etc.)
  muted: '#64748b',        // helper / hint / subtitle text — a touch darker
                           // than before (was #94a3b8) for readability, still
                           // clearly lighter than inkSoft so hierarchy holds
  // Brand identity — used by the wordmark, logo, and any screen element
  // that should carry the brand tone (e.g., the About title). Same value
  // as the "grn" status pill ink, intentionally — green is the brand.
  brand: '#15803d',
  // icon chip: white fill, grey outline, dark glyph
  iconBg: '#ffffff',
  iconBorder: '#94a3b8',
  iconInk: '#334155',
  // tabs
  tabIdleBg: '#f1f5f9',
  tabIdleInk: '#64748b',
  tabActiveBg: '#0f172a',
  tabActiveInk: '#ffffff',
  // primary action button
  btnBg: '#0f172a',
  btnInk: '#ffffff',
  status: STATUS.light,
};

const DARK = {
  mode: 'dark',
  bg: '#0b1220',           // near-black canvas
  canvas: '#0b1220',
  card: '#161f2e',         // dark slate card
  line: '#26334a',
  ink: '#f1f5f9',          // light text
  inkSoft: '#cbd5e1',      // secondary text
  muted: '#94a3b8',        // helper / hint / subtitle text — a step brighter
                           // than before (was #7c8aa0) so it reads better on
                           // the dark canvas, still dimmer than inkSoft
  // Brand identity — brighter green for dark mode contrast. Matches the
  // dark-theme grn pill ink so the brand reads consistently against the
  // dark canvas.
  brand: '#4ade80',
  iconBg: '#1c2740',
  iconBorder: '#3a4a66',
  iconInk: '#cbd5e1',
  tabIdleBg: '#1c2740',
  tabIdleInk: '#9aa8bf',
  tabActiveBg: '#f1f5f9',  // inverted: light tab on dark
  tabActiveInk: '#0f172a',
  btnBg: '#f1f5f9',
  btnInk: '#0f172a',
  status: STATUS.dark,
};

// ----- Shared scale (same in both themes) -----
export const type = {
  // System font for now. To use Inter later: set fontFamily to 'Inter_xxx'
  // and load via expo-font; everything else stays.
  fontFamily: undefined, // undefined = system font (San Francisco on iOS)
  kicker:      { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  // Display title — large hero text. Available if a screen wants it.
  title:       { fontSize: 30, fontWeight: '800', letterSpacing: 0.5 },
  // Canonical screen title — what "Due Soon", "Settings", "Device detail"
  // and every other screen header should use. Spread it with the spread
  // operator: `title: { ...t.type.screenTitle, color: t.ink, ... }`.
  screenTitle: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  // Smaller title variant — for nested or secondary headers.
  titleSm:     { fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  body:        { fontSize: 15, fontWeight: '600' },
  meta:        { fontSize: 12, fontWeight: '500' },
  pill:        { fontSize: 11.5, fontWeight: '700' },
  btn:         { fontSize: 15, fontWeight: '700' },
};

export const space  = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 28 };
export const radius = { sm: 6, md: 8, chip: 11, card: 12, pill: 6, btn: 11 };

export function useTheme() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? DARK : LIGHT;
  return { ...palette, type, space, radius };
}

export { LIGHT, DARK };
