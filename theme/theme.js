// theme.js — single source of truth for The Filter List's look.
// Theme-aware: light + dark palettes, switched by the system color scheme.
// Every screen pulls from useTheme(); nothing hardcodes a color.
// Font is the system font for now (clean, zero-setup); swap to Inter later
// by changing `fontFamily` here only.

import { useColorScheme } from 'react-native';

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
  inkSoft: '#475569',
  muted: '#94a3b8',

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
  inkSoft: '#cbd5e1',
  muted: '#7c8aa0',

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
  // Canonical screen title — what "Due Soon", "Settings", "Filter detail"
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