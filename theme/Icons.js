// theme/Icons.js — brand logo + filter type icons as SVG components.
// All accept `color` so they adapt to theme.

import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

// ----- Brand logo (layers / stacked filtration curves) -----
export function LogoMark({ size = 22, color = '#0f172a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Path d="M4 7c4-2 12-2 16 0" />
      <Path d="M5 12c3.5-1.6 10.5-1.6 14 0" />
      <Path d="M7 17c2.5-1.2 7.5-1.2 10 0" />
    </Svg>
  );
}

// ----- Tiny solid water drop, used as the dot on the "i" in the wordmark -----
export function TinyDrop({ size = 8, color = '#0f172a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2.5c-3.5 5-6 8-6 11a6 6 0 0 0 12 0c0-3-2.5-6-6-11z" />
    </Svg>
  );
}

// ----- Water: double drop (one larger in front, smaller behind) -----
export function IconWater({ size = 28, color = '#334155' }) {
  // outlined drops to match the reference's stroked look, with the front drop overlapping the back
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      {/* back/smaller drop */}
      <Path d="M16 3c-2 2.6-3.4 4.7-3.4 6.3a3.4 3.4 0 0 0 6.8 0C19.4 7.7 18 5.6 16 3z" />
      {/* front/larger drop, overlapping back */}
      <Path d="M10 8c-2.6 3.6-4.4 6.2-4.4 8.5a4.4 4.4 0 0 0 8.8 0c0-2.3-1.8-4.9-4.4-8.5z" fill={color === '#fff' || color === '#f1f5f9' ? 'transparent' : 'transparent'} />
    </Svg>
  );
}

// ----- Air: stylized X of four rounded "pebble" rectangles (your reference) -----
// Modern, no actual fan reference. Four rounded shapes arranged in an X cluster.
export function IconAir({ size = 28, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round">
      {/* top-left pebble */}
      <Path d="M4.5 4.5c-0.4 2.2 0 4.4 2.2 4.8 2.2 0.4 4-1.4 4-3.2s-2-3.6-3.8-3.6c-1.4 0-2.2 0.8-2.4 2z" />
      {/* top-right pebble */}
      <Path d="M14 4c-1.8 0.4-2.6 2.2-2 4 0.6 1.8 2.6 2.8 4.4 2.2s2.4-2.6 1.6-4.2c-0.8-1.6-2.2-2.4-4-2z" />
      {/* bottom-left pebble */}
      <Path d="M4 13.6c-0.4 2 0.6 4 2.6 4.4 2 0.4 4.2-1.2 4-3.2s-2.2-3.6-4-3.4c-1.6 0.2-2.4 0.8-2.6 2.2z" />
      {/* bottom-right pebble */}
      <Path d="M13.6 13.4c-1.6 1-1.6 3.2-0.2 4.6 1.4 1.4 3.8 1.2 4.8-0.4 1-1.6 0.4-3.8-1.2-4.6-1.2-0.6-2.4-0.4-3.4 0.4z" />
    </Svg>
  );
}

// ----- Other: rounded square with divider -----
export function IconOther({ size = 26, color = '#334155' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Rect x="4" y="4" width="16" height="16" rx="3" />
      <Path d="M4 12h16" />
    </Svg>
  );
}

// ----- Gear -----
export function IconGear({ size = 14, color = '#475569' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

// Big back chevron
export function IconBack({ size = 26, color = '#0f172a' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18 L9 12 L15 6" />
    </Svg>
  );
}

// Map type -> icon component
export function TypeIcon({ type, size = 26, color = '#334155' }) {
  if (type === 'water') return <IconWater size={size} color={color} />;
  if (type === 'air')   return <IconAir size={size} color={color} />;
  return <IconOther size={size} color={color} />;
}

// Branded wordmark: "The Filter L" + tiny drop dot above the "i" stem + "st"
// Renders as a row of Text spans + the drop positioned over the "i".
// Used in the header lockup.
