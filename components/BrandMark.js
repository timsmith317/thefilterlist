// components/BrandMark.js
//
// The Filter List brand mark — the "stacked sheets" app-icon motif as a
// lightweight, scalable component. It's just four rounded Views, so there's no
// SVG library or image asset to manage, it stays crisp at any size, and it
// matches assets/icon.png exactly.
//
// Use it anywhere the logo appears:  <BrandMark size={32} />
// Default size is 64. The mark draws transparent (no square background), so it
// sits cleanly on any surface — a header, a card, the onboarding tile, etc.

import React from 'react';
import { View } from 'react-native';

// width fraction + color per sheet, lightest/narrowest at top to
// brand-green/widest at the bottom (mirrors the icon).
const BARS = [
  { w: 0.56, c: '#86efac' },
  { w: 0.67, c: '#4ade80' },
  { w: 0.78, c: '#22c55e' },
  { w: 0.90, c: '#15803d' },
];

export default function BrandMark({ size = 64 }) {
  const barH = size * 0.14;
  const gap = size * 0.06;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {BARS.map((b, i) => (
        <View
          key={i}
          style={{
            width: size * b.w,
            height: barH,
            borderRadius: barH / 2,
            backgroundColor: b.c,
            marginTop: i === 0 ? 0 : gap,
          }}
        />
      ))}
    </View>
  );
}