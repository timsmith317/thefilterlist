// theme/Icons.js — brand logo + the three filter-type icons as SVG components.
// All accept a `color` prop so they adapt to light/dark via the theme.
// Requires react-native-svg (bundled with Expo).

import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

// Brand logo: stacked filtration layers (option D).
export function LogoMark({ size = 18, color = '#0f172a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Path d="M4 7c4-2 12-2 16 0" />
      <Path d="M5 12c3.5-1.6 10.5-1.6 14 0" />
      <Path d="M7 17c2.5-1.2 7.5-1.2 10 0" />
    </Svg>
  );
}

// Water: drop
export function IconWater({ size = 22, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2.5c-3.5 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2.5-6-6-11z" />
    </Svg>
  );
}

// Air: fan in X orientation
export function IconAir({ size = 22, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <G transform="rotate(45 12 12)">
        <Circle cx="12" cy="12" r="2.3" />
        <Path d="M12 9.7c0-3 .4-5.7-1.5-6.4-2-.7-3.4 1.8-2.3 3.9.8 1.6 2.4 2 3.8 2.5z" />
        <Path d="M14.3 12c3 0 5.7.4 6.4-1.5.7-2-1.8-3.4-3.9-2.3-1.6.8-2 2.4-2.5 3.8z" />
        <Path d="M12 14.3c0 3-.4 5.7 1.5 6.4 2 .7 3.4-1.8 2.3-3.9-.8-1.6-2.4-2-3.8-2.5z" />
        <Path d="M9.7 12c-3 0-5.7-.4-6.4 1.5-.7 2 1.8 3.4 3.9 2.3 1.6-.8 2-2.4 2.5-3.8z" />
      </G>
    </Svg>
  );
}

// Other: rounded square with divider
export function IconOther({ size = 22, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Rect x="4" y="4" width="16" height="16" rx="3" />
      <Path d="M4 12h16" />
    </Svg>
  );
}

// Gear (settings)
export function IconGear({ size = 14, color = '#475569' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

// Map a filter type to its icon component
export function TypeIcon({ type, size = 22, color = '#334155' }) {
  if (type === 'water') return <IconWater size={size} color={color} />;
  if (type === 'air') return <IconAir size={size} color={color} />;
  return <IconOther size={size} color={color} />;
}
