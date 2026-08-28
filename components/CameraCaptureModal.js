// File: components/CameraCaptureModal.js → ~/Projects/thefilterlist/components/CameraCaptureModal.js
//
// components/CameraCaptureModal.js — in-app camera capture in the app's framed
// style, built on expo-camera (CameraView).
//
// PORTRAIT-ONLY CAPTURE (the decision that ends the orientation fight):
//   Every photo is captured with the device held UPRIGHT. That is the whole
//   design. A portrait capture produces a portrait sensor frame, which is
//   already 3:4 — so the viewfinder matches the capture, the cropper opens on
//   what was framed, and the 3:4 strip slot fills with no bars. Landscape
//   capture was the single variable that broke all three, so it is removed
//   rather than compensated for.
//
//   HOW IT'S ENFORCED — in JS, not by an OS orientation lock:
//     - The modal measures its own box. If it's wider than tall, the device is
//       being held sideways.
//     - In landscape the viewfinder renders as a WIDE 4:3 frame with the live
//       preview ROTATED 90°, so the scene appears on its side. It reads as
//       obviously wrong, which is the cue to turn the device.
//     - The shutter is DISABLED while sideways, with an explicit prompt. This
//       is the load-bearing part: capture simply cannot happen in landscape.
//     - Turn the device upright and everything snaps to the normal portrait
//       3:4 viewfinder with a live shutter. No prebuild, no native module.
//
//   WHY NOT expo-screen-orientation: its portrait lockAsync did not engage on
//   the Pixel Tablet in this RN / react-native-screens version — the capture UI
//   stayed upright in landscape and capture went through anyway. A measured
//   layout can't fail that way, and it drops a native dependency.
//
// The capture still grabs the full sensor frame and the final 3:4 is chosen in
// the PhotoCropper afterward (pinch/zoom/pan on a 3:4 frame). Portrait-only
// capture is what makes that frame reachable without guessing.
//
// expo-camera is a native module — needs a dev rebuild. Preview does NOT render
// in Mac screen-mirroring; test on a physical device.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../theme/theme';
import { BackButton } from './HeaderBits';
import { prepareCameraPhoto } from '../lib/filterPhotos';

export default function CameraCaptureModal({ visible, onCancel, onCapture }) {
  const t = useTheme();
  const s = makeStyles(t);
  const camRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });

  // Ask for camera permission when the sheet opens.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    if (!visible) { setReady(false); setBusy(false); }
  }, [visible, permission]);

  // Measure the viewfinder AREA rather than reading Dimensions: this is the
  // actual laid-out box inside the Modal, so it is correct on both platforms
  // and updates on every rotation without a listener.
  const onAreaLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setArea({ w: width, h: height });
  };

  // Device held sideways?
  const isLandscape = area.w > 0 && area.w > area.h;

  // Largest 3:4 box that fits when upright; largest 4:3 box when sideways. The
  // sideways frame is deliberately WIDE — it is the shape of the screen you are
  // holding, and the rotated preview inside it is what signals "turn me".
  const frameBox = useMemo(() => {
    if (!area.w || !area.h) return { w: 0, h: 0 };
    if (isLandscape) {
      let h = area.h;
      let w = (h * 4) / 3;
      if (w > area.w) { w = area.w; h = (w * 3) / 4; }
      return { w: Math.round(w), h: Math.round(h) };
    }
    let w = area.w;
    let h = (w * 4) / 3;
    if (h > area.h) { h = area.h; w = (h * 3) / 4; }
    return { w: Math.round(w), h: Math.round(h) };
  }, [area, isLandscape]);

  // While sideways, the preview lives in a box with WIDTH and HEIGHT SWAPPED,
  // rotated 90° about its centre. Offsetting by half the difference centres the
  // swapped box inside the frame before the rotation lands it flush.
  const rotatedPreview = useMemo(() => {
    if (!isLandscape || !frameBox.w) return null;
    return {
      width: frameBox.h,
      height: frameBox.w,
      left: (frameBox.w - frameBox.h) / 2,
      top: (frameBox.h - frameBox.w) / 2,
    };
  }, [isLandscape, frameBox]);

  const flip = () => setFacing((f) => (f === 'back' ? 'front' : 'back'));

  const shoot = async () => {
    // Portrait-only: the sideways guard is here as well as on the button, so no
    // code path can capture a landscape frame.
    if (busy || isLandscape || !camRef.current || !ready) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (photo && photo.uri) {
        // Make the camera asset look like a library asset (baked orientation +
        // matching dims) so the identical cropper — which works for library
        // imports — handles it correctly.
        const prepared = await prepareCameraPhoto(photo.uri, photo.width, photo.height);
        setBusy(false);
        onCapture(prepared || { uri: photo.uri, width: photo.width, height: photo.height });
      } else {
        setBusy(false);
      }
    } catch (e) {
      setBusy(false);
      console.warn('takePictureAsync failed', e);
    }
  };

  const granted = !!(permission && permission.granted);
  const canShoot = granted && ready && !busy && !isLandscape;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <View style={s.head}>
            <BackButton onPress={onCancel} />
            {granted && !isLandscape && (
              <Pressable onPress={flip} hitSlop={10} style={s.flipBtn}>
                <Text style={s.flipTxt}>Flip</Text>
              </Pressable>
            )}
          </View>

          <View style={s.area} onLayout={onAreaLayout}>
            {!granted ? (
              <View style={s.denied}>
                <Text style={s.deniedTitle}>Camera access needed</Text>
                <Text style={s.deniedSub}>Allow camera access to take a photo of this filter.</Text>
                {permission && permission.canAskAgain ? (
                  <Pressable style={s.cta} onPress={() => requestPermission()}>
                    <Text style={s.ctaTxt}>Allow Camera</Text>
                  </Pressable>
                ) : (
                  <Pressable style={s.cta} onPress={() => Linking.openSettings()}>
                    <Text style={s.ctaTxt}>Open Settings</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={[s.frame, frameBox.w > 0 && { width: frameBox.w, height: frameBox.h }]}>
                {rotatedPreview ? (
                  // SIDEWAYS: swapped-size box, rotated 90°, so the scene shows
                  // on its side inside a wide frame.
                  <View
                    style={[
                      s.rotatedLayer,
                      {
                        width: rotatedPreview.width,
                        height: rotatedPreview.height,
                        left: rotatedPreview.left,
                        top: rotatedPreview.top,
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <CameraView
                      ref={camRef}
                      style={StyleSheet.absoluteFill}
                      facing={facing}
                      onCameraReady={() => setReady(true)}
                    />
                  </View>
                ) : (
                  <CameraView
                    ref={camRef}
                    style={StyleSheet.absoluteFill}
                    facing={facing}
                    onCameraReady={() => setReady(true)}
                  />
                )}

                {isLandscape && (
                  <View style={s.turnOverlay} pointerEvents="none">
                    <View style={s.turnCard}>
                      <Text style={s.turnGlyph}>⤾</Text>
                      <Text style={s.turnTitle}>Turn your device upright</Text>
                      <Text style={s.turnSub}>Photos are captured in portrait so they fill the frame.</Text>
                    </View>
                  </View>
                )}

                {busy && (
                  <View style={s.busyOverlay} pointerEvents="none"><ActivityIndicator color="#fff" /></View>
                )}
              </View>
            )}
          </View>

          <View style={s.shutterRow}>
            {granted && (
              <>
                <Pressable
                  onPress={shoot}
                  disabled={!canShoot}
                  hitSlop={10}
                  style={[s.shutterOuter, !canShoot && { opacity: 0.35 }]}
                >
                  <View style={s.shutterInner} />
                </Pressable>
                {isLandscape && <Text style={s.shutterHint}>Rotate to portrait to capture</Text>}
              </>
            )}
          </View>
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
    flipBtn: { backgroundColor: t.tabIdleBg, paddingHorizontal: t.ui(14), paddingVertical: t.ui(7), borderRadius: 999 },
    flipTxt: { color: t.ink, fontSize: t.uit(14), fontWeight: '700' },

    // Viewfinder area. 3:4 portrait when upright, 4:3 wide when sideways.
    area: { flex: 1, paddingHorizontal: 18, paddingTop: 2, alignItems: 'center', justifyContent: 'center' },
    frame: {
      borderRadius: 16, overflow: 'hidden',
      backgroundColor: '#000', borderWidth: 1.5, borderColor: t.iconBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    // Swapped-dimension layer, rotated a quarter turn. Absolutely positioned so
    // the offsets computed above centre it inside the wide frame.
    rotatedLayer: { position: 'absolute', transform: [{ rotate: '90deg' }] },

    turnOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    turnCard: {
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 26, paddingVertical: 20,
      borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)',
    },
    turnGlyph: { fontSize: t.uit(34), color: '#fff', marginBottom: 8 },
    turnTitle: { fontSize: t.uit(17), fontWeight: '700', color: '#fff', textAlign: 'center' },
    turnSub: { fontSize: t.uit(13), color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 6 },

    busyOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },

    denied: {
      alignSelf: 'stretch', flex: 1, borderRadius: 16, borderWidth: 1.5, borderColor: t.iconBorder,
      backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28,
    },
    deniedTitle: { fontSize: t.uit(16), fontWeight: '700', color: t.ink, marginBottom: 6 },
    deniedSub: { fontSize: t.uit(13), color: t.muted, textAlign: 'center', marginBottom: 18 },
    cta: { backgroundColor: t.tabIdleBg, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
    ctaTxt: { color: t.ink, fontSize: t.uit(14), fontWeight: '700' },

    shutterRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 22 },
    shutterOuter: {
      width: 74, height: 74, borderRadius: 999, borderWidth: 4, borderColor: t.iconBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    shutterInner: { width: 58, height: 58, borderRadius: 999, backgroundColor: t.tabIdleBg },
    shutterHint: { marginTop: 10, fontSize: t.uit(13), fontWeight: '600', color: t.muted },
  });
}
