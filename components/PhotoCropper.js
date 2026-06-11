// components/PhotoCropper.js — pinch-zoom-pan cropper for Filter reference
// photos. Replaces iOS's built-in "Move and Scale" editor, which is square-fill
// only (zoom IN only). Here userScale starts at 1 = the WHOLE image fit inside
// the square frame, so you can keep the entire (tall) device OR zoom in to crop
// tighter.
//
// Presented as the same themed iOS SHEET (presentationStyle="pageSheet") the
// photo viewer / pickers use: white background, the photo in a centered framed
// card, ‹ Back + a standard "Add" PillButton in the header. Only the look
// changed — the crop frame, gestures, and geometry are unchanged.
//
// Geometry lives in lib/cropmath.js (pure + unit-tested). On "Add" we map the
// square frame back to source pixels and crop via expo-image-manipulator.
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
import { baseScaleFor, clampPan, computeCropRect } from '../lib/cropmath';
import { cropAndPersist } from '../lib/filterPhotos';

const MAX_SCALE = 6;

export default function PhotoCropper({ visible, asset, onCancel, onDone }) {
  const t = useTheme();
  const s = makeStyles(t);

  const [frame, setFrame] = useState(0);   // square crop side (screen px)
  const [dims, setDims] = useState(null);  // natural image size { w, h }
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
    scale.value = 1; savedScale.value = 1;
    tx.value = 0; ty.value = 0; savedTx.value = 0; savedTy.value = 0;
    if (asset.width && asset.height) {
      setDims({ w: asset.width, h: asset.height });
    } else {
      Image.getSize(asset.uri, (w, h) => setDims({ w, h }), () => setDims({ w: 1, h: 1 }));
    }
  }, [asset?.uri]);

  const settle = () => {
    if (!dims || !frame) return;
    const c = clampPan(tx.value, ty.value, dims.w, dims.h, frame, scale.value);
    tx.value = withTiming(c.tx, { duration: 120 });
    ty.value = withTiming(c.ty, { duration: 120 });
    savedTx.value = c.tx; savedTy.value = c.ty;
    savedScale.value = scale.value;
  };

  const pinch = Gesture.Pinch()
    .onUpdate(e => { scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale)); })
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
              setFrame(Math.max(0, Math.min(width, height) - 36));
            }}
          >
            {asset && dims && frame > 0 && (
              <View style={[s.frame, { width: frame, height: frame }]}>
                <GestureDetector gesture={composed}>
                  <Animated.View style={[s.gestureLayer, { width: frame, height: frame }]}>
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
      paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
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
    hintTxt: { color: t.muted, fontSize: 13, fontWeight: '600' },
  });
}
