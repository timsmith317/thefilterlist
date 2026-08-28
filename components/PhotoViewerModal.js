// components/PhotoViewerModal.js — framed, swipeable, pinch-zoom photo viewer.
//
// Read-only viewer opened from the Filter Detail screen. Presented as the same
// iOS SHEET (presentationStyle="pageSheet") the icon/manual pickers use, with the
// app's white/themed background, so it reads as an integrated modal rather than a
// dark overlay. The photo sits in a centered, themed FRAME (a card) in the middle.
//   - Always opens on the photo that was TAPPED (the `index` prop), regardless
//     of where a previous viewing session left the carousel.
//   - Swipe left/right to move through the filter's photos (a horizontal paging
//     ScrollView; one square page per photo).
//   - Pinch to zoom / pan within the current photo. Each page is itself a
//     zoomable ScrollView (iOS minimum/maximumZoomScale); at zoom 1 the page has
//     no scroll room, so horizontal swipes fall through to the pager, and when
//     zoomed the drag pans the photo, handing back to the pager only at the edge.
//   - Header: the app's ‹ Back (left) and the standard "Save to Photos" PillButton
//     (right), which saves the photo currently shown.
//
// Photos are stored as relative filenames; photoUri() resolves them for display
// and saveToPhotos() writes the current one to the library (both in lib/filterPhotos).

import React, { useEffect, useRef, useState } from 'react';
import { View, Modal, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';
import { BackButton, PillButton } from './HeaderBits';
import { photoUri, saveToPhotos } from '../lib/filterPhotos';
import { frameHeightFor } from '../lib/cropmath';

export default function PhotoViewerModal({ visible, photos = [], index = 0, onClose }) {
  const t = useTheme();
  const s = makeStyles(t);
  const [side, setSide] = useState(0);   // frame WIDTH (px); height is 3:4
  const [cur, setCur] = useState(index);
  const [busy, setBusy] = useState(false);
  const pagerRef = useRef(null);

  // Reset to the requested start index whenever the viewer (re)opens.
  useEffect(() => {
    if (visible) setCur(index);
  }, [visible, index]);

  // Track the previous frame width so we can tell a ROTATION (side changed while
  // already open) apart from the initial open.
  const prevLayoutW = useRef(0);

  // OPEN snap: when the viewer opens (and once side is known), jump to the
  // REQUESTED photo `index` — NOT `cur`, which on open still holds the previous
  // session's page (the reset effect above hasn't applied yet). This is the
  // "reopens on the last photo I swiped to" guard.
  useEffect(() => {
    if (visible && side > 0 && pagerRef.current) {
      pagerRef.current.scrollTo({ x: index * side, y: 0, animated: false });
    }
  }, [visible, index]);

  // NOTE: the rotation re-snap is handled by the pager's onLayout (below), which
  // fires exactly when the ScrollView resizes — the definitive signal, with no
  // frame-timing guesswork. See onLayout on the horizontal pager.

  const onMomentumEnd = (e) => {
    if (!side) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / side);
    if (i !== cur) setCur(i);
  };

  const onSave = async () => {
    if (busy || !photos[cur]) return;
    setBusy(true);
    const ok = await saveToPhotos(photos[cur]);
    setBusy(false);
    if (ok) Alert.alert('Saved', 'Photo saved to your library.');
  };

  // Round the 3:4 height ONCE so the frame, pager, pages, and image all get the
  // exact same integer height — otherwise each view rounds the fractional
  // frameHeightFor(side) independently and a 1-2px gap shows at the bottom.
  const frameH = Math.round(frameHeightFor(side));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <View style={s.head}>
            <BackButton onPress={onClose} />
            <PillButton label="Save to Photos" onPress={onSave} />
          </View>

          <View
            style={s.frameWrap}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              // Fit a 3:4 PORTRAIT frame: width bounded by area width, and its
              // derived height (w*4/3) bounded by area height.
              const availW = Math.max(0, width - 36);
              const availH = Math.max(0, height - 36);
              const wByHeight = (availH * 3) / 4;
              setSide(Math.round(Math.min(availW, wByHeight)));
            }}
          >
            {side > 0 && photos.length > 0 && (
              // Rounded corners live on this plain WRAPPER View, not on the
              // ScrollView: a ScrollView clips its scrolling content unevenly
              // (top corners round, bottom stay square). A non-scrolling View
              // with borderRadius + overflow hidden clips all four corners
              // reliably. The pager fills it exactly.
              <View style={[s.clip, { width: side, height: frameH }]}>
                <ScrollView
                  ref={pagerRef}
                  horizontal
                  pagingEnabled
                  bounces={false}
                  overScrollMode="never"
                  style={{ width: side, height: frameH }}
                  contentOffset={{ x: index * side, y: 0 }}
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onMomentumEnd}
                  onLayout={(e) => {
                    // Fires when the pager (re)sizes. On a genuine RESIZE — the
                    // width changed from a known previous value, i.e. rotation —
                    // snap to the current photo at the new width. This is the
                    // definitive re-align signal, independent of rAF timing. We
                    // skip the initial layout (prevLayoutW 0) so we never fight
                    // the open-snap-to-index with a stale `cur`.
                    const w = e.nativeEvent.layout.width;
                    if (prevLayoutW.current && Math.abs(prevLayoutW.current - w) > 1) {
                      if (pagerRef.current && side > 0) {
                        pagerRef.current.scrollTo({ x: cur * side, y: 0, animated: false });
                      }
                    }
                    prevLayoutW.current = w;
                  }}
                >
                  {photos.map((p, i) => (
                    <ScrollView
                      key={i}
                      style={{ width: side, height: frameH }}
                      contentContainerStyle={{ width: side, height: frameH }}
                      maximumZoomScale={3}
                      minimumZoomScale={1}
                      bounces={false}
                      bouncesZoom={false}
                      overScrollMode="never"
                      centerContent
                      showsVerticalScrollIndicator={false}
                      showsHorizontalScrollIndicator={false}
                    >
                      <Image source={{ uri: photoUri(p) }} style={{ width: side, height: frameH }} resizeMode="contain" />
                    </ScrollView>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {photos.length > 1 && (
            <View style={s.dots}>
              {photos.map((_, i) => (
                <View key={i} style={[s.dot, i === cur && s.dotOn]} />
              ))}
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    safe: { flex: 1 },

    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
    },

    frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // Plain wrapper that clips the pager to rounded corners (all four, evenly).
    // Not a ScrollView, so the radius applies uniformly.
    clip: { borderRadius: 16, overflow: 'hidden' },

    dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 18 },
    dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: t.line },
    dotOn: { backgroundColor: t.ink },
  });
}