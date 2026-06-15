// components/BrandMark.js
//
// The Filter List brand mark — the full app-icon motif (three "filter"
// pills, the bottom one toggled on with a check) as a lightweight,
// scalable component. It's just rounded Views, so there's no SVG library
// or image asset to manage, it stays crisp at any size, and it matches
// assets/icon.png exactly.
//
// Unlike the old version, this draws the COMPLETE icon — its own emerald
// field and rounded corners included — so it looks identical to the
// home-screen icon wherever it sits. Place it directly; it needs no tile
// background or border around it.
//
// Use it anywhere the logo appears:  <BrandMark size={32} />   (default 64)

import React from 'react';
import { View } from 'react-native';

const C = {
  field: '#10B981', // emerald
  pill:  '#FAF7EE', // ivory
  off:   '#85D8B8', // off-knob (ivory↔emerald tint)
  on:    '#14532D', // forest (the checked knob)
  check: '#FFFFFF',
};

// Geometry as fractions of the square size (mirrors assets/icon.png).
const PILL_W = 0.50;
const PILL_H = 0.165;
const ROWS = [0.30, 0.505, 0.71]; // row centers, top→bottom
const KNOB_R = PILL_H / 2 - 0.014;
const CORNER = 0.225; // rounded-square corner (the on-screen squircle look)

export default function BrandMark({ size = 64 }) {
  const s = size;
  const pillH = PILL_H * s;
  const pillW = PILL_W * s;
  const pillR = pillH / 2;
  const pillLeft = (0.5 - PILL_W / 2) * s;
  const knobR = KNOB_R * s;
  const knobLeftCX = pillLeft + pillH / 2;          // left-end knob center x
  const knobRightCX = pillLeft + pillW - pillH / 2; // right-end knob center x

  const knob = (cx, cy, color, key) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: cx - knobR,
        top: cy - knobR,
        width: knobR * 2,
        height: knobR * 2,
        borderRadius: knobR,
        backgroundColor: color,
      }}
    />
  );

  // Check = two rounded bars inside the bottom-right (on) knob.
  const ckx = knobRightCX;
  const cky = ROWS[2] * s;
  const r = knobR;
  const pts = [
    [ckx - 0.46 * r, cky + 0.02 * r],
    [ckx - 0.10 * r, cky + 0.36 * r],
    [ckx + 0.48 * r, cky - 0.32 * r],
  ];
  const cw = Math.max(1.5, 0.24 * r); // stroke weight (and cap radius)
  const seg = (a, b, key) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    return (
      <View
        key={key}
        style={{
          position: 'absolute',
          left: mx - (len + cw) / 2, // +cw so the round caps cover the joint
          top: my - cw / 2,
          width: len + cw,
          height: cw,
          borderRadius: cw / 2,
          backgroundColor: C.check,
          transform: [{ rotate: `${ang}deg` }],
        }}
      />
    );
  };

  return (
    <View
      style={{
        width: s,
        height: s,
        borderRadius: CORNER * s,
        backgroundColor: C.field,
        overflow: 'hidden',
      }}
    >
      {ROWS.map((cyf, i) => (
        <View
          key={`pill${i}`}
          style={{
            position: 'absolute',
            left: pillLeft,
            top: cyf * s - pillH / 2,
            width: pillW,
            height: pillH,
            borderRadius: pillR,
            backgroundColor: C.pill,
          }}
        />
      ))}
      {knob(knobLeftCX, ROWS[0] * s, C.off, 'off0')}
      {knob(knobLeftCX, ROWS[1] * s, C.off, 'off1')}
      {knob(knobRightCX, ROWS[2] * s, C.on, 'on')}
      {seg(pts[0], pts[1], 'c0')}
      {seg(pts[1], pts[2], 'c1')}
    </View>
  );
}
