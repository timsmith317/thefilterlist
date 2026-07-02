// theme.js — single source of truth for The Filter List's look.
// Theme-aware: light + dark palettes, switched by the system color scheme
// OR by an explicit user choice (Settings → Appearance).
// Every screen pulls from useTheme(); nothing hardcodes a color.
// Font is the system font for now (clean, zero-setup); swap to Inter later
// by changing `fontFamily` here only.

import { useState, useEffect } from 'react';
import { useColorScheme, Appearance, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ----- iPad scale system (mirrors Podium Notes' ui()/uit() approach) -----
// On iPad, phone-sized type and chrome look undersized. We scale with two
// tunable factors via helpers returned from useTheme():
//   t.ui()  — chrome/spacing/icons.
//   t.uit() — typography.
// Both are no-ops on iPhone, so iPhone layout is completely unaffected.
//
// TABLET_SCALE is the single knob. Start at 1.2; tune during the iPad audit.
const TABLET_SCALE = 1.3;        // chrome / spacing / icons
const TABLET_TEXT_SCALE = 1.4;   // typography (kept equal to TABLET_SCALE for now)

// Detection threshold (shortest side, in pt). The iPad mini's short side is
// ~744pt in portrait — BELOW the common 768 cutoff — so we use 700 to make
// sure the mini counts as a tablet. Phones (even Max) stay well under 700.
const TABLET_MIN_SHORT_SIDE = 700;

// NOTE: detection now uses the useWindowDimensions() hook inside useTheme(),
// not a module-load Dimensions.get(). The hook reads correct values and
// updates on rotation, so isTablet is reliable and orientation-aware.

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
// These are BUILDERS parameterized by the scale helpers, because scaling now
// depends on runtime dimensions (isTablet from the hook). useTheme() calls
// them with the current ui()/uit() so type/spacing scale on iPad and stay
// identity on iPhone. Every screen spreads t.type.* / t.space.*, so this
// scales text and spacing app-wide with no per-screen edits.
const makeType = (uit) => ({
  fontFamily: undefined, // undefined = system font (San Francisco on iOS)
  kicker:      { fontSize: uit(11), fontWeight: '700', letterSpacing: 1.6 },
  title:       { fontSize: uit(30), fontWeight: '800', letterSpacing: 0.5 },
  screenTitle: { fontSize: uit(26), fontWeight: '800', letterSpacing: 0.5 },
  titleSm:     { fontSize: uit(22), fontWeight: '800', letterSpacing: 0.2 },
  body:        { fontSize: uit(15), fontWeight: '600' },
  meta:        { fontSize: uit(12), fontWeight: '500' },
  pill:        { fontSize: uit(11.5), fontWeight: '700' },
  btn:         { fontSize: uit(15), fontWeight: '700' },
});
const makeSpace  = (ui) => ({ xs: ui(4), sm: ui(8), md: ui(12), lg: ui(16), xl: ui(22), xxl: ui(28) });
const makeRadius = (ui) => ({ sm: ui(6), md: ui(8), chip: ui(11), card: ui(12), pill: ui(6), btn: ui(11) });

export function useTheme() {
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? DARK : LIGHT;

  // Reactive dimensions — reads correctly and updates on rotation.
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN_SHORT_SIDE;

  // Scale helpers: identity on iPhone, ×factor (rounded) on iPad.
  const ui  = (n) => (isTablet ? Math.round(n * TABLET_SCALE) : n);
  const uit = (n) => (isTablet ? Math.round(n * TABLET_TEXT_SCALE) : n);

  // Build the scaled tokens for this render.
  const type   = makeType(uit);
  const space  = makeSpace(ui);
  const radius = makeRadius(ui);

  return { ...palette, type, space, radius, ui, uit, isTablet };
}

export { LIGHT, DARK };
