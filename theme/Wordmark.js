// theme/Wordmark.js — "The Filter List" rendered with a tiny water drop replacing
// the dot on the "i" in "Filter" for branding flavor.
//
// Approach: render "The F" + a wrapper View containing "i" (with a transparent
// "no-dot" trick via lineHeight isn't reliable; instead we render the full text
// and overlay a tiny drop atop the i's dot using measured offsets.) The simplest
// robust path: render two Text spans split around the "i", and between them
// render an "i" stem only (a vertical line) with a tiny drop above it.

import React from 'react';
import { View, Text } from 'react-native';
import { TinyDrop } from './Icons';

export default function Wordmark({ color = '#0f172a', size = 26 }) {
  // We render: "The F" [iStem with drop above] "lter List"
  // The iStem is a thin vertical Text "l" (lowercase L) — visually almost
  // identical to an "i" stem at most weights, but doesn't carry its own dot.
  // Actually cleaner: use a View with a small rect for the stem. Text wrapping
  // would be safer though. Try: render full text as one span, and overlay the
  // drop positioned over where the "i" dot should be. Since text metrics are
  // tricky, we accept a tiny visual quirk: render "The F" + "ilter List"
  // normally (which still has the dot), and place the drop *over* that dot.
  // To do this we need to know where the "i" sits — we approximate by
  // rendering them as separate Text views and measuring the "F"+ offset.
  //
  // Pragmatic implementation: render "The F" and "lter List" as two Text
  // pieces with a tight gap between them, and in that gap render an "i" stem
  // (a small View) with a TinyDrop positioned above it. This avoids overlay
  // measurement entirely.

  const stemWidth = Math.max(2, Math.round(size * 0.08));
  const stemHeight = Math.round(size * 0.55);
  const dropSize = Math.round(size * 0.22);
  const baseFont = { fontSize: size, fontWeight: '800', color, letterSpacing: -0.4, includeFontPadding: false };

  // We render the wordmark on a baseline. iOS includes top padding by default
  // in Text; we use a row that aligns by baseline.
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Text style={baseFont}>The F</Text>
      {/* i-stem area: stem at the baseline, drop floating above */}
      <View style={{ width: stemWidth + 4, height: size * 1.0, marginHorizontal: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ position: 'absolute', top: size * 0.20, alignSelf: 'center' }}>
          <TinyDrop size={dropSize} color={color} />
        </View>
        <View style={{ width: stemWidth, height: stemHeight, backgroundColor: color, borderRadius: stemWidth / 2, marginBottom: size * 0.06 }} />
      </View>
      <Text style={baseFont}>lter List</Text>
    </View>
  );
}
