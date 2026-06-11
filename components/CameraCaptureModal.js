// components/CameraCaptureModal.js — in-app camera capture in the app's framed
// style, replacing the full-screen iOS system camera (expo-image-picker's
// launchCameraAsync) for a more custom feel.
//
// Same themed iOS SHEET (presentationStyle="pageSheet") as the viewer/cropper:
// white background and the app's ‹ Back, but the framed area is a LARGE,
// near-full-bleed live camera preview (expo-camera's CameraView) rather than a
// small square — easier to aim. A round shutter captures; a Flip control swaps
// front/back.
//
// On capture, onCapture({ uri, width, height }) hands the photo to the SAME
// PhotoCropper the library flow uses, so framing/crop stays identical. This
// component only captures; it never persists.
//
// expo-camera is a native module — needs a dev rebuild (it was added via
// `expo install expo-camera`). Camera permission is requested on open; a denied
// state offers Settings.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../theme/theme';
import { BackButton } from './HeaderBits';

export default function CameraCaptureModal({ visible, onCancel, onCapture }) {
  const t = useTheme();
  const s = makeStyles(t);
  const camRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [busy, setBusy] = useState(false);

  // Ask for camera access when the sheet opens, if we still can.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, permission?.granted]);

  const flip = () => setFacing(f => (f === 'back' ? 'front' : 'back'));

  const shoot = async () => {
    if (busy || !camRef.current) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 1 });
      setBusy(false);
      if (photo && photo.uri) onCapture({ uri: photo.uri, width: photo.width, height: photo.height });
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

          <View style={s.area}>
            {!permission ? (
              <View style={s.frame}><ActivityIndicator color={t.muted} /></View>
            ) : granted ? (
              <View style={s.frame}>
                <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing={facing} />
                {busy && (
                  <View style={s.busyOverlay} pointerEvents="none"><ActivityIndicator color="#fff" /></View>
                )}
              </View>
            ) : (
              <View style={s.denied}>
                <Text style={s.deniedTitle}>Camera access needed</Text>
                <Text style={s.deniedSub}>Allow camera access to take a photo of this filter.</Text>
                {permission.canAskAgain ? (
                  <Pressable style={s.cta} onPress={() => requestPermission()}>
                    <Text style={s.ctaTxt}>Allow Camera</Text>
                  </Pressable>
                ) : (
                  <Pressable style={s.cta} onPress={() => Linking.openSettings()}>
                    <Text style={s.ctaTxt}>Open Settings</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          <View style={s.shutterRow}>
            {granted && (
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
    flipBtn: { backgroundColor: t.tabIdleBg, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
    flipTxt: { color: t.ink, fontSize: 14, fontWeight: '700' },

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
    deniedTitle: { fontSize: 16, fontWeight: '700', color: t.ink, marginBottom: 6 },
    deniedSub: { fontSize: 13, color: t.muted, textAlign: 'center', marginBottom: 18 },
    cta: { backgroundColor: t.tabIdleBg, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 },
    ctaTxt: { color: t.ink, fontSize: 14, fontWeight: '700' },

    shutterRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 22 },
    shutterOuter: {
      width: 74, height: 74, borderRadius: 999, borderWidth: 4, borderColor: t.line,
      alignItems: 'center', justifyContent: 'center',
    },
    shutterInner: { width: 58, height: 58, borderRadius: 999, backgroundColor: t.iconBorder },
  });
}