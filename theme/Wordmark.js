// theme/Wordmark.js — plain text "The Filter List" wordmark.
//
// Defaults to t.brand (the brand green) but accepts a `color` override
// for callers that want a specific tone (e.g., the login splash where
// the wordmark might want pure white over a hero image).
//
// The drop-on-i graphic will be handled later as a designed asset.

import React from 'react';
import { Text } from 'react-native';
import { useTheme } from './theme';

export default function Wordmark({ color, size = 26 }) {
  const t = useTheme();
  const ink = color || t.brand;
  return (
    <Text style={{ fontSize: size, fontWeight: '800', color: ink, letterSpacing: -0.4 }}>
      The Filter List
    </Text>
  );
}