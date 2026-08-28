// File: components/PhotoCropper.js → ~/Projects/thefilterlist/components/PhotoCropper.js
//
// components/PhotoCropper.js — pinch-zoom-pan cropper for Filter reference
// photos. Replaces iOS's built-in "Move and Scale" editor, which is square-fill
// only (zoom IN only). Here userScale starts at 1 = the WHOLE image fit inside
// the square frame, so you can keep the entire (tall) device OR zoom in to crop
// tighter.
//
// Presented as the same themed iOS SHEET (presentationStyle="pageSheet") the
// photo viewer / pickers use: white background, the photo in a centered framed
// card, ‹ Back + a standard "Add" PillButton in the header. Only the look
// changed — the crop frame is now 3:4 portrait; gestures/geometry via cropmath.
//
// Geometry lives in lib/cropmath.js (pure + unit-tested). On "Add" we map the
// 3:4 frame back to source pixels and crop via expo-image-manipulator.
//
// Deps already in the app: react-native-gesture-handler, react-native-reanimated.
// New dep: expo-image-manipulator (used inside lib/filterPhotos.cropAndPersist).

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { useTheme } from '../theme/theme';
import { BackButton, PillButton } from './HeaderBits';
import { baseScaleFor, clampPan, computeCropRect, frameHeightFor, fitWidthScale } from '../lib/cropmath';
import { cropAndPersist } from '../lib/filterPhotos';

// Distance from the top of the sheet to the header row. These modals use
// SafeAreaView edges={['bottom']} — the TOP inset is deliberately not applied,
// because inside an iOS pageSheet the reported top inset is the window's, not
// the sheet's, and using it over-pads on iPhone. So the clearance is an explicit
// constant instead. 44 clears the tablet's sheet grabber, which 14 did not.
// Keep this identical in PhotoCropper and CameraCaptureModal so the two screens
// line up as you move between them.
const HEADER_TOP_PAD = 44;

const MAX_SCALE = 6;
// Users can zoom OUT below the auto-fit (cover) start to see the whole photo,
// accepting bars in the 3:4 frame if they choose. Floor is a small fraction so
// even a big image can be pulled fully into view. The auto-fit start still fills
// the frame; this only sets how far OUT they can pull from there.
const MIN_SCALE = 0.5;

export default function PhotoCropper({ visible, asset, onCancel, onDone }) {
  const t = useTheme();
  const s = makeStyles(t);

  const [frame, setFrame] = useState(0);   // crop frame WIDTH (screen px); height = 3:4
  const [dims, setDims] = useState(null);  // natural image size { w, h }
  const [minScale, setMinScale] = useState(1); // scale that covers the 3:4 frame
  const [busy, setBusy] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // Reset transform + (re)load natural dimensions whenever a new photo opens.
  useEffect(() => {
    if (!asset) { setDims(null); return; }
    tx.value = 0; ty.value = 0; savedTx.value = 0; savedTy.value = 0;
    if (asset.width && asset.height) {
      setDims({ w: asset.width, h: asset.height });
    } else {
      Image.getSize(asset.uri, (w, h) => setDims({ w, h }), () => setDims({ w: 1, h: 1 }));
    }
  }, [asset?.uri]);

  // Once we know the image size AND the frame, START at fit-WIDTH: the full
  // width of the photo is visible (nothing cut off the sides), with bars top/
  // bottom for square/tall photos. The user pans/zooms freely from here; they
  // can zoom out further (MIN_SCALE) or in (MAX_SCALE). On save, whatever is in
  // the 3:4 frame is captured — the user's choice, not an assumed center crop.
  useEffect(() => {
    if (!dims || !frame) return;
    const fw = fitWidthScale(dims.w, dims.h, frame);
    setMinScale(fw);
    scale.value = fw; savedScale.value = fw;
    tx.value = 0; ty.value = 0; savedTx.value = 0; savedTy.value = 0;
  }, [dims, frame]);

  const settle = () => {
    if (!dims || !frame) return;
    const c = clampPan(tx.value, ty.value, dims.w, dims.h, frame, scale.value);
    tx.value = withTiming(c.tx, { duration: 120 });
    ty.value = withTiming(c.ty, { duration: 120 });
    savedTx.value = c.tx; savedTy.value = c.ty;
    savedScale.value = scale.value;
  };

  const pinch = Gesture.Pinch()
    .onUpdate(e => { scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale)); })
    .onEnd(() => { runOnJS(settle)(); });

  const pan = Gesture.Pan()
    .onUpdate(e => { tx.value = savedTx.value + e.translationX; ty.value = savedTy.value + e.translationY; })
    .onEnd(() => { runOnJS(settle)(); });

  const composed = Gesture.Simultaneous(pinch, pan);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const onUse = async () => {
    if (!dims || !frame || busy) return;
    const rect = computeCropRect(dims.w, dims.h, frame, scale.value, tx.value, ty.value);
    if (rect.width < 1 || rect.height < 1) return;
    setBusy(true);
    const persisted = await cropAndPersist(asset.uri, rect);
    setBusy(false);
    onDone(persisted);
  };

  // Fit size of the image inside the frame at userScale 1.
  let dispW = 0, dispH = 0;
  if (dims && frame) {
    const base = baseScaleFor(dims.w, dims.h, frame);
    dispW = dims.w * base;
    dispH = dims.h * base;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <GestureHandlerRootView style={s.root}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <View style={s.head}>
            <BackButton onPress={onCancel} />
            <PillButton label="Add" onPress={onUse} />
          </View>

          <View
            style={s.area}
            onLayout={e => {
              const { width, height } = e.nativeEvent.layout;
              // Fit a 3:4 PORTRAIT frame: width bounded by area width, and its
              // derived height (w*4/3) bounded by area height. Pad by 36.
              const availW = Math.max(0, width - 36);
              const availH = Math.max(0, height - 36);
              const wByHeight = (availH * 3) / 4;
              setFrame(Math.round(Math.min(availW, wByHeight)));
            }}
          >
            {asset && dims && frame > 0 && (
              <View style={[s.frame, { width: frame, height: frameHeightFor(frame) }]}>
                <GestureDetector gesture={composed}>
                  <Animated.View style={[s.gestureLayer, { width: frame, height: frameHeightFor(frame) }]}>
                    <Animated.Image
                      source={{ uri: asset.uri }}
                      style={[{ width: dispW, height: dispH }, imgStyle]}
                      resizeMode="cover"
                    />
                  </Animated.View>
                </GestureDetector>
                {busy && (
                  <View style={s.busyOverlay} pointerEvents="none">
                    <ActivityIndicator color={t.ink} />
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={s.hint}><Text style={s.hintTxt}>Pinch to zoom · drag to position</Text></View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

function makeStyles(t) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    safe: { flex: 1 },

    head: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 18, paddingTop: HEADER_TOP_PAD, paddingBottom: 10,
    },

    area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    // Square crop frame, matched to the photo viewer's framed card. overflow
    // hidden so the preview shows EXACTLY what's kept (clipped to rounded corners).
    frame: {
      overflow: 'hidden', borderRadius: 16,
      backgroundColor: t.card, borderWidth: 1.5, borderColor: t.iconBorder,
    },
    gestureLayer: { alignItems: 'center', justifyContent: 'center' },
    busyOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.35)',
    },

    hint: { alignItems: 'center', paddingVertical: 16 },
    hintTxt: { color: t.muted, fontSize: t.uit(13), fontWeight: '600' },
  });
}