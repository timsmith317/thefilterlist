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

export default function PhotoViewerModal({ visible, photos = [], index = 0, onClose }) {
  const t = useTheme();
  const s = makeStyles(t);
  const [side, setSide] = useState(0);   // square frame side (px)
  const [cur, setCur] = useState(index);
  const [busy, setBusy] = useState(false);
  const pagerRef = useRef(null);

  // Reset to the requested start index whenever the viewer (re)opens.
  useEffect(() => {
    if (visible) setCur(index);
  }, [visible, index]);

  // Snap the pager to the REQUESTED photo when the viewer opens (and once the
  // frame size is known).
  //
  // This must scroll to `index`, NOT `cur`. Both effects run in the same pass
  // when the viewer opens, so reading `cur` here would see the PREVIOUS
  // session's page (the reset above hasn't applied yet) — which was the
  // "always reopens on the last photo I swiped to" bug. `index` is the source
  // of truth for "what was tapped," and it only changes while the viewer is
  // closed, so this never fights an in-progress swipe.
  useEffect(() => {
    if (visible && side > 0 && pagerRef.current) {
      pagerRef.current.scrollTo({ x: index * side, y: 0, animated: false });
    }
  }, [visible, side, index]);

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
              setSide(Math.max(0, Math.min(width, height) - 36));
            }}
          >
            {side > 0 && photos.length > 0 && (
              <View style={[s.frame, { width: side, height: side }]}>
                <ScrollView
                  ref={pagerRef}
                  horizontal
                  pagingEnabled
                  // Initial offset for a fresh mount: RN's Modal unmounts its
                  // children while hidden, so the pager remounts on every open
                  // at offset 0. This puts it on the tapped photo from the
                  // first frame — covering the window where an imperative
                  // scrollTo could land before the native view has measured.
                  contentOffset={{ x: index * side, y: 0 }}
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onMomentumEnd}
                >
                  {photos.map((p, i) => (
                    <ScrollView
                      key={i}
                      style={{ width: side, height: side }}
                      contentContainerStyle={{ width: side, height: side }}
                      maximumZoomScale={3}
                      minimumZoomScale={1}
                      bouncesZoom
                      centerContent
                      showsVerticalScrollIndicator={false}
                      showsHorizontalScrollIndicator={false}
                    >
                      <Image source={{ uri: photoUri(p) }} style={{ width: side, height: side }} resizeMode="contain" />
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
    frame: {
      borderRadius: 16, overflow: 'hidden',
      backgroundColor: t.card, borderWidth: 1.5, borderColor: t.iconBorder,
    },

    dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 18 },
    dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: t.line },
    dotOn: { backgroundColor: t.ink },
  });
}