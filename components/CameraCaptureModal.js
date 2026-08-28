// components/CameraCaptureModal.js — in-app camera capture in the app's framed
// style, built on expo-camera (CameraView). Replaces the earlier
// react-native-vision-camera modal (whose preview and capture disagreed) and
// the native-OS-camera detour.
//
// KEY DESIGN:
//   The viewfinder is a 3:4 portrait frame the camera preview FILLS (overflow
//   clipped). It's a rough aim — the capture grabs the full sensor frame, and the
//   final 3:4 is chosen in the PhotoCropper afterward (pinch/zoom/pan on a 3:4
//   frame). The cropper GUARANTEES 3:4 output regardless of how the device was
//   held, so every saved photo fills the 3:4 strip slot uniformly. We do NOT lock
//   orientation — expo-screen-orientation's portrait lock is unreliable in this
//   RN/react-native-screens version (a documented bug), and guaranteeing 3:4 in
//   the cropper makes the lock unnecessary anyway.
//
// expo-camera is a native module — needs a dev rebuild. Preview does NOT render
// in Mac screen-mirroring; test on a physical device.

import React, { useEffect, useRef, useState } from 'react';
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
  const [frameBox, setFrameBox] = useState({ w: 0, h: 0 });

  // Ask for camera permission when the sheet opens.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    if (!visible) { setReady(false); setBusy(false); }
  }, [visible, permission]);

  // Fit the largest 3:4 PORTRAIT rectangle into the available area.
  const onAreaLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    let w = width;
    let h = (w * 4) / 3;          // 3:4 portrait
    if (h > height) { h = height; w = (h * 3) / 4; }
    setFrameBox({ w: Math.round(w), h: Math.round(h) });
  };

  const flip = () => setFacing((f) => (f === 'back' ? 'front' : 'back'));

  const shoot = async () => {
    if (busy || !camRef.current || !ready) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (photo && photo.uri) {
        // Make the camera asset look like a library asset (baked orientation +
        // matching dims) so the identical cropper — which works for library
        // imports — handles it correctly. Both platforms.
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <View style={s.head}>
            <BackButton onPress={onCancel} />
            {granted && (
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
                <CameraView
                  ref={camRef}
                  style={StyleSheet.absoluteFill}
                  facing={facing}
                  onCameraReady={() => setReady(true)}
                />
                {busy && (
                  <View style={s.busyOverlay} pointerEvents="none"><ActivityIndicator color="#fff" /></View>
                )}
              </View>
            )}
          </View>

          <View style={s.shutterRow}>
            {granted && (
              <Pressable onPress={shoot} disabled={busy || !ready} hitSlop={10} style={[s.shutterOuter, (busy || !ready) && { opacity: 0.5 }]}>
                <View style={s.shutterInner} />
              </Pressable>
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

    // 3:4 portrait viewfinder, centered in the available area.
    area: { flex: 1, paddingHorizontal: 18, paddingTop: 2, alignItems: 'center', justifyContent: 'center' },
    frame: {
      borderRadius: 16, overflow: 'hidden',
      backgroundColor: '#000', borderWidth: 1.5, borderColor: t.iconBorder,
      alignItems: 'center', justifyContent: 'center',
    },
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
  });
}
