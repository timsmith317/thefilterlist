// theme/Wordmark.js — plain text "The Filter List" wordmark.
// The drop-on-i graphic will be handled later as a designed asset.

import React from 'react';
import { Text } from 'react-native';

export default function Wordmark({ color = '#0f172a', size = 26 }) {
  return (
    <Text style={{ fontSize: size, fontWeight: '800', color, letterSpacing: -0.4 }}>
      The Filter List
    </Text>
  );
}
