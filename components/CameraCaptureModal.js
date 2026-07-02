// components/CameraCaptureModal.js — in-app camera capture in the app's framed
// style, replacing the full-screen iOS system camera (expo-image-picker's
// launchCameraAsync) for a more custom feel.
//
// Now built on react-native-vision-camera (matching Hanger's proven camera
// stack) instead of expo-camera. The reason for the swap: expo-camera's config
// plugin injects an NSMicrophoneUsageDescription that can't be cleanly removed,
// which is an App Store 5.1.1(ii) rejection risk. vision-camera does not inject
// a mic key (its plugin is pinned with enableMicrophonePermission:false in
// app.config.js), so this app requests only the camera — no microphone.
//
// Same themed iOS SHEET (presentationStyle="pageSheet") as the viewer/cropper:
// white background and the app's ‹ Back, but the framed area is a LARGE,
// near-full-bleed live camera preview rather than a small square — easier to
// aim. A round shutter captures; a Flip control swaps front/back.
//
// On capture, onCapture({ uri, width, height }) hands the photo to the SAME
// PhotoCropper the library flow uses, so framing/crop stays identical. This
// component only captures; it never persists. vision-camera returns a bare
// filesystem `path`; we prefix it to a file:// URI so the cropper (and the rest
// of the app, which expects URIs) can consume it unchanged.
//
// vision-camera is a native module — needs a dev rebuild. The live preview does
// NOT render in Mac screen-mirroring; test on the physical device.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useTheme } from '../theme/theme';
import { BackButton } from './HeaderBits';

export default function CameraCaptureModal({ visible, onCancel, onCapture }) {
  const t = useTheme();
  const s = makeStyles(t);
  const camRef = useRef(null);

  const { hasPermission, requestPermission } = useCameraPermission();
  const [position, setPosition] = useState('back');
  const device = useCameraDevice(position);
  const [busy, setBusy] = useState(false);
  // Tracks whether we've already prompted this open, so a denied state can
  // switch from "Allow Camera" (re-request) to "Open Settings" (iOS won't
  // prompt again). vision-camera's hook has no canAskAgain flag, so we infer it.
  const [askedOnce, setAskedOnce] = useState(false);

  // Ask for camera access when the sheet opens, if we don't have it yet.
  useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission().finally(() => setAskedOnce(true));
    }
    if (!visible) setAskedOnce(false); // reset for next open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, hasPermission]);

  const flip = () => setPosition((p) => (p === 'back' ? 'front' : 'back'));

  const shoot = async () => {
    if (busy || !camRef.current) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePhoto({ flash: 'off' });
      // vision-camera returns a bare path; the rest of the app expects a URI.
      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      setBusy(false);
      // IMPORTANT: do NOT pass photo.width/height. vision-camera reports sensor
      // dimensions in the sensor's native orientation, which for a portrait shot
      // disagrees with how the file actually displays (EXIF rotation). Passing
      // them made PhotoCropper lay out with the wrong aspect, so a square crop
      // saved as a tall rectangle. Omitting them makes the cropper fall back to
      // Image.getSize(uri) — the SAME EXIF-correct path library picks use — so
      // camera captures now crop identically to library photos.
      onCapture({ uri });
    } catch (e) {
      setBusy(false);
      console.warn('takePhoto failed', e);
    }
  };

  // Only run the camera session while the sheet is open AND we have permission
  // AND a device exists — releases the camera when the sheet closes.
  const active = !!(visible && hasPermission && device);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={s.root}>
        <SafeAreaView style={s.safe} edges={['bottom']}>
          <View style={s.head}>
            <BackButton onPress={onCancel} />
            {hasPermission && !!device && (
              <Pressable onPress={flip} hitSlop={10} style={s.flipBtn}>
                <Text style={s.flipTxt}>Flip</Text>
              </Pressable>
            )}
          </View>

          <View style={s.area}>
            {!hasPermission ? (
              <View style={s.denied}>
                <Text style={s.deniedTitle}>Camera access needed</Text>
                <Text style={s.deniedSub}>Allow camera access to take a photo of this filter.</Text>
                {!askedOnce ? (
                  <Pressable style={s.cta} onPress={() => requestPermission()}>
                    <Text style={s.ctaTxt}>Allow Camera</Text>
                  </Pressable>
                ) : (
                  <Pressable style={s.cta} onPress={() => Linking.openSettings()}>
                    <Text style={s.ctaTxt}>Open Settings</Text>
                  </Pressable>
                )}
              </View>
            ) : !device ? (
              // vision-camera can return a null device (e.g. simulator, or the
              // requested position isn't available) — expo-camera never did, so
              // this guard is new and prevents a crash.
              <View style={s.denied}>
                <Text style={s.deniedTitle}>No camera available</Text>
                <Text style={s.deniedSub}>Couldn't find the {position} camera on this device.</Text>
                <Pressable style={s.cta} onPress={flip}>
                  <Text style={s.ctaTxt}>Try other camera</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.frame}>
                <Camera
                  ref={camRef}
                  style={StyleSheet.absoluteFill}
                  device={device}
                  isActive={active}
                  photo={true}
                />
                {busy && (
                  <View style={s.busyOverlay} pointerEvents="none"><ActivityIndicator color="#fff" /></View>
                )}
              </View>
            )}
          </View>

          <View style={s.shutterRow}>
            {hasPermission && !!device && (
              <Pressable onPress={shoot} disabled={busy} hitSlop={10} style={[s.shutterOuter, busy && { opacity: 0.5 }]}>
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

    // Large, near-full-bleed framed preview.
    area: { flex: 1, paddingHorizontal: 18, paddingTop: 2 },
    frame: {
      flex: 1, borderRadius: 16, overflow: 'hidden',
      backgroundColor: '#000', borderWidth: 1.5, borderColor: t.iconBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    busyOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },

    denied: {
      flex: 1, borderRadius: 16, borderWidth: 1.5, borderColor: t.iconBorder, backgroundColor: t.card,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28,
    },
    deniedTitle: { fontSize: t.uit(16), fontWeight: '700', color: t.ink, marginBottom: 6 },
    deniedSub: { fontSize: t.uit(13), color: t.muted, textAlign: 'center', marginBottom: 18 },
    cta: { backgroundColor: t.tabIdleBg, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
    ctaTxt: { color: t.ink, fontSize: t.uit(14), fontWeight: '700' },

    shutterRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 22 },
    shutterOuter: {
      // Darker ring holds a lighter fill — the contrast is what reads as a
      // shutter button. Ring darker than fill (iconBorder vs tabIdleBg).
      width: 74, height: 74, borderRadius: 999, borderWidth: 4, borderColor: t.iconBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    shutterInner: { width: 58, height: 58, borderRadius: 999, backgroundColor: t.tabIdleBg },
  });
}