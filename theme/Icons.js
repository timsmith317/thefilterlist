// theme/Icons.js — brand logo + filter type icons.
// Logo: thicker strokes + curves that fill more of the viewBox (visually
// bumps the graphic without changing the chip size).
// Water: front drop now carries a small inner arc at the bottom for depth,
// matching the dimensional feel of the reference image.

import React from 'react';
import Svg, { Path, Circle, Rect, Ellipse } from 'react-native-svg';

// Brand logo — thicker strokes and curves that extend closer to the viewBox
// edges, so the graphic reads bigger inside the same chip.
export function LogoMark({ size = 24, color = '#0f172a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.8} strokeLinecap="round">
      {/* Curves widened: now extend from x=2.5 to x=21.5 (was 4 to 20). */}
      <Path d="M2.5 6.5c4.5-2.3 14.5-2.3 19 0" />
      <Path d="M3.5 12c4-1.8 13-1.8 17 0" />
      <Path d="M5.5 17.5c3-1.4 10-1.4 13 0" />
    </Svg>
  );
}

// Water: double drop, the front (larger) drop now has an inner arc at the
// bottom that suggests depth — matches the reference where the front drop
// has a curved line tracing its lower-right interior.
export function IconWater({ size = 32, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinejoin="round" strokeLinecap="round">
      {/* back/smaller drop */}
      <Path d="M15 2.5 C 13 5.1, 11.7 7.2, 11.7 8.8 a 3.3 3.3 0 0 0 6.6 0 C 18.3 7.2, 17 5.1, 15 2.5 z" />
      {/* front/larger drop */}
      <Path d="M8.5 7 C 5.9 10.6, 4.1 13.2, 4.1 15.5 a 4.4 4.4 0 0 0 8.8 0 C 12.9 13.2, 11.1 10.6, 8.5 7 z" />
      {/* depth arc — inner curve at the bottom of the front drop, tracing
          the lower-right interior. Adds the dimensional feel from the
          reference photo. */}
      <Path d="M11.3 13.5 a 3.1 3.1 0 0 1 -2.8 4.4" strokeWidth={1.4} />
    </Svg>
  );
}

// Air: stylized pebbles in X. Unchanged.
export function IconAir({ size = 32, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinejoin="round">
      <Ellipse cx="7.5" cy="7.5" rx="3.4" ry="2.6" transform="rotate(-45 7.5 7.5)" />
      <Ellipse cx="16.5" cy="7.5" rx="3.4" ry="2.6" transform="rotate(45 16.5 7.5)" />
      <Ellipse cx="7.5" cy="16.5" rx="3.4" ry="2.6" transform="rotate(45 7.5 16.5)" />
      <Ellipse cx="16.5" cy="16.5" rx="3.4" ry="2.6" transform="rotate(-45 16.5 16.5)" />
    </Svg>
  );
}

export function IconOther({ size = 30, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.1}>
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

export function TypeIcon({ type, size = 32, color = '#334155' }) {
  if (type === 'water') return <IconWater size={size} color={color} />;
  if (type === 'air')   return <IconAir size={size} color={color} />;
  return <IconOther size={size} color={color} />;
}
