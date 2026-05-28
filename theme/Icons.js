// theme/Icons.js — brand logo + filter type icons as SVG components.
// Air icon recomposed using explicit ellipses arranged in an X around the
// viewBox center (12,12) so it's truly centered in the chip.

import React from 'react';
import Svg, { Path, Circle, Rect, G, Ellipse } from 'react-native-svg';

export function LogoMark({ size = 22, color = '#0f172a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Path d="M4 7c4-2 12-2 16 0" />
      <Path d="M5 12c3.5-1.6 10.5-1.6 14 0" />
      <Path d="M7 17c2.5-1.2 7.5-1.2 10 0" />
    </Svg>
  );
}

// Water: double drop (outlined; one large in front, smaller behind).
// viewBox 0..24, cluster designed to sit centered.
export function IconWater({ size = 28, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      {/* back/smaller drop, upper-right */}
      <Path d="M16.5 3 C 14.5 5.6, 13.2 7.7, 13.2 9.3 a 3.3 3.3 0 0 0 6.6 0 C 19.8 7.7, 18.5 5.6, 16.5 3 z" />
      {/* front/larger drop, lower-left, overlapping */}
      <Path d="M10 7.5 C 7.4 11.1, 5.6 13.7, 5.6 16 a 4.4 4.4 0 0 0 8.8 0 C 14.4 13.7, 12.6 11.1, 10 7.5 z" />
    </Svg>
  );
}

// Air: stylized X of four rounded "pebble" shapes, centered around (12,12).
// Using ellipses so they're guaranteed centered; rotated slightly for the
// pebble-in-X arrangement you referenced.
export function IconAir({ size = 28, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round">
      {/* top-left pebble: tilted ellipse */}
      <Ellipse cx="7.5" cy="7.5" rx="3.4" ry="2.6" transform="rotate(-45 7.5 7.5)" />
      {/* top-right pebble */}
      <Ellipse cx="16.5" cy="7.5" rx="3.4" ry="2.6" transform="rotate(45 16.5 7.5)" />
      {/* bottom-left pebble */}
      <Ellipse cx="7.5" cy="16.5" rx="3.4" ry="2.6" transform="rotate(45 7.5 16.5)" />
      {/* bottom-right pebble */}
      <Ellipse cx="16.5" cy="16.5" rx="3.4" ry="2.6" transform="rotate(-45 16.5 16.5)" />
    </Svg>
  );
}

export function IconOther({ size = 26, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Rect x="4" y="4" width="16" height="16" rx="3" />
      <Path d="M4 12h16" />
    </Svg>
  );
}

export function IconGear({ size = 14, color = '#475569' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

export function IconBack({ size = 26, color = '#0f172a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18 L9 12 L15 6" />
    </Svg>
  );
}

export function TypeIcon({ type, size = 30, color = '#334155' }) {
  if (type === 'water') return <IconWater size={size} color={color} />;
  if (type === 'air')   return <IconAir size={size} color={color} />;
  return <IconOther size={size} color={color} />;
}
