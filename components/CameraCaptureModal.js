// File: components/CameraCaptureModal.js → ~/Projects/thefilterlist/components/CameraCaptureModal.js
//
// components/CameraCaptureModal.js — in-app camera capture in the app's framed
// style, built on expo-camera (CameraView).
//
// POINT, SHOOT, SAVED. onCapture receives a STORED FILENAME, ready for the
// strip — not an asset to be cropped. The viewfinder is the crop; you already
// framed the shot. The cropper is for library imports only.
//
// PORTRAIT-ONLY CAPTURE (the decision that ends the orientation fight):
//   Every photo is captured with the device held UPRIGHT. A portrait capture
//   produces a portrait sensor frame, which is already 3:4 — so the viewfinder
//   matches the capture and the 3:4 strip slot fills with no bars.
//
//   HOW IT'S ENFORCED — measured layout, not an OS orientation lock:
//     - The body measures itself. Wider than tall = device held sideways.
//     - Sideways: the CameraView is UNMOUNTED and the frame shows a solid black
//       "camera off" panel with a turn-upright prompt. The shutter sits to the
//       LEFT of the frame — where "below the viewfinder" lands once the device
//       is turned — and is disabled. Its label is ROTATED a quarter turn, so it
//       only reads correctly after you turn the device: an instruction you have
//       to obey before you can read it can't be mistaken for a live button.
//     - Upright: normal portrait 3:4 viewfinder, camera live, shutter beneath.
//
//   WHY THE CAMERA IS UNMOUNTED SIDEWAYS, not rotated:
//     expo-camera on Android renders through a CameraX PreviewView backed by a
//     SurfaceView. A SurfaceView does not honour a parent rotate transform, and
//     it composites as a hole in the window — so a rotated preview rendered at
//     its own aspect in the middle of the frame and the app behind the modal
//     showed through the rest. Measured on the Pixel Tablet: a 793x597 frame
//     with a 448x597 preview and the filter form visible around it. Not mounting
//     the camera removes the surface entirely, so the panel is genuinely blank.
//
//   WHY NOT expo-screen-orientation: its portrait lockAsync did not engage on
//   the Pixel Tablet in this RN / react-native-screens version — the capture UI
//   stayed upright in landscape and capture went through anyway.
//
// LAYOUT: the viewfinder is full-bleed on a phone and pulled in on a tablet
// (see PHONE_FRAME_SCALE / TABLET_FRAME_SCALE). The frame and the shutter are
// ONE centred group, not two things at opposite ends of the screen. That's what keeps the button snug against the
// viewfinder wherever the scale shrinks the frame — the leftover space falls
// outside the group instead of opening a gap inside it. A spacer mirrors the
// shutter column when sideways so the frame still lands screen-centred.
//
// expo-camera is a native module — needs a dev rebuild. Preview does NOT render
// in Mac screen-mirroring; test on a physical device.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../theme/theme';
import { BackButton } from './HeaderBits';
import { captureAndPersist } from '../lib/filterPhotos';

// Distance from the top of the sheet to the header row. These modals use
// SafeAreaView edges={['bottom']} — the TOP inset is deliberately not applied,
// because inside an iOS pageSheet the reported top inset is the window's, not
// the sheet's, and using it over-pads on iPhone. So the clearance is an explicit
// constant instead. 44 clears the tablet's sheet grabber, which 14 did not.
// Keep this identical in PhotoCropper and CameraCaptureModal so the two screens
// line up as you move between them.
const HEADER_TOP_PAD = 44;

// Fraction of the largest fitting box the viewfinder actually uses.
// A phone screen has little enough room that the viewfinder should simply take
// what's available — 70% of a small screen reads as cramped. A tablet has space
// to spare, where a full-bleed frame reads as overwhelming rather than generous,
// so it gets pulled in. Keyed off t.isTablet (device class), NOT Platform.OS:
// an iPad should behave like the Pixel Tablet, not like an iPhone.
const PHONE_FRAME_SCALE = 1;
const TABLET_FRAME_SCALE = 0.7;
// Width of the shutter column when sideways (mirrored as a spacer on the right
// so the frame stays screen-centred).
const SHUTTER_COL_W = 150;
// Space between the frame and the shutter, on whichever side it sits.
const FRAME_GAP = 18;
// Vertical room the shutter needs below the frame in portrait (button + slack).
const SHUTTER_BLOCK = 96;
// Extra breathing room above the frame in portrait.
const PORTRAIT_TOP_PAD = 28;

export default function CameraCaptureModal({ visible, onCancel, onCapture }) {
  const t = useTheme();
  const s = makeStyles(t);
  const camRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [body, setBody] = useState({ w: 0, h: 0 });
  const [area, setArea] = useState({ w: 0, h: 0 });

  // Ask for camera permission when the sheet opens.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    if (!visible) { setReady(false); setBusy(false); }
  }, [visible, permission]);

  // Orientation comes from the BODY box (everything under the header) rather
  // than Dimensions: it's the actual laid-out container inside the Modal, so
  // it's right on both platforms and updates on every rotation with no listener.
  const onBodyLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setBody({ w: width, h: height });
  };

  const onAreaLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setArea({ w: width, h: height });
  };

  const isLandscape = body.w > 0 && body.w > body.h;
  const frameScale = t.isTablet ? TABLET_FRAME_SCALE : PHONE_FRAME_SCALE;

  // The camera is torn down when we go sideways, so it will re-initialise on the
  // way back to portrait — clear ready so the shutter waits for it.
  useEffect(() => {
    if (isLandscape) setReady(false);
  }, [isLandscape]);

  // Largest 3:4 box that fits when upright; largest 4:3 box when sideways —
  // scaled by frameScale (full on a phone, pulled in on a tablet). The
  // final clamp only bites on a small screen where the scaled frame plus the
  // shutter wouldn't fit; on the tablet it never fires, so the size you approved
  // is unchanged.
  const frameBox = useMemo(() => {
    if (!area.w || !area.h) return { w: 0, h: 0 };
    // area.h is the view's OUTER height; the portrait top padding eats into what
    // children actually get, so discount it before fitting.
    const availW = area.w;
    const availH = area.h - (isLandscape ? 0 : PORTRAIT_TOP_PAD);

    let w, h;
    if (isLandscape) {
      h = availH;
      w = (h * 4) / 3;
      if (w > availW) { w = availW; h = (w * 3) / 4; }
    } else {
      w = availW;
      h = (w * 4) / 3;
      if (h > availH) { h = availH; w = (h * 3) / 4; }
    }
    w *= frameScale;
    h *= frameScale;

    // Leave room for the shutter beside (sideways) or below (upright) the frame.
    // On a phone at full scale this clamp is what actually sets the size — the
    // frame grows until the shutter needs the space, which is the intent.
    if (isLandscape) {
      const maxW = availW - 2 * (SHUTTER_COL_W + FRAME_GAP);
      if (maxW > 0 && w > maxW) { w = maxW; h = (w * 3) / 4; }
    } else {
      const maxH = availH - (SHUTTER_BLOCK + FRAME_GAP);
      if (maxH > 0 && h > maxH) { h = maxH; w = (h * 3) / 4; }
    }
    return { w: Math.round(w), h: Math.round(h) };
  }, [area, isLandscape, frameScale]);

  const flip = () => setFacing((f) => (f === 'back' ? 'front' : 'back'));

  const shoot = async () => {
    // Portrait-only: guarded here as well as on the button, so no code path can
    // capture a landscape frame.
    if (busy || isLandscape || !camRef.current || !ready) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (photo && photo.uri) {
        // Straight to storage — no cropper in this path.
        const stored = await captureAndPersist(photo.uri, photo.width, photo.height);
        setBusy(false);
        onCapture(stored);
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

  // Sideways: label first (screen-left of the button = "below" it once turned),
  // rotated a quarter turn so it only reads upright after you rotate. The column
  // is right-aligned so the button hugs the frame rather than floating.
  const shutter = granted ? (
    <View style={isLandscape ? s.shutterCol : s.shutterRow}>
      {isLandscape && (
        <View style={s.hintSlot}>
          <Text style={s.hintRotated}>Rotate to capture</Text>
        </View>
      )}
      <Pressable
        onPress={shoot}
        disabled={!canShoot}
        hitSlop={10}
        style={[s.shutterOuter, !canShoot && { opacity: 0.35 }]}
      >
        <View style={s.shutterInner} />
      </Pressable>
    </View>
  ) : null;

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

          <View style={s.body} onLayout={onBodyLayout}>
            <View style={[s.area, !isLandscape && { paddingTop: PORTRAIT_TOP_PAD }]} onLayout={onAreaLayout}>
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
                // Frame + shutter as one centred group, so the leftover space
                // sits outside the pair instead of between them.
                <View style={[s.group, isLandscape && s.groupRow]}>
                  {isLandscape && shutter}

                  <View style={[s.frame, frameBox.w > 0 && { width: frameBox.w, height: frameBox.h }]}>
                    {isLandscape ? (
                      // Camera deliberately NOT mounted — see the SurfaceView
                      // note above. A plain black panel, so nothing shows through.
                      <View style={s.turnPanel}>
                        <Text style={s.turnGlyph}>⤾</Text>
                        <Text style={s.turnTitle}>Turn your device upright</Text>
                        <Text style={s.turnSub}>Photos are captured in portrait so they fill the frame.</Text>
                      </View>
                    ) : (
                      <CameraView
                        ref={camRef}
                        style={StyleSheet.absoluteFill}
                        facing={facing}
                        onCameraReady={() => setReady(true)}
                      />
                    )}

                    {busy && (
                      <View style={s.busyOverlay} pointerEvents="none"><ActivityIndicator color="#fff" /></View>
                    )}
                  </View>

                  {/* Mirrors the shutter column so the frame stays centred. */}
                  {isLandscape && <View style={s.colSpacer} />}
                  {!isLandscape && shutter}
                </View>
              )}
            </View>
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
      paddingHorizontal: 18, paddingTop: HEADER_TOP_PAD, paddingBottom: 10,
    },
    flipBtn: { backgroundColor: t.tabIdleBg, paddingHorizontal: t.ui(14), paddingVertical: t.ui(7), borderRadius: 999 },
    flipTxt: { color: t.ink, fontSize: t.uit(14), fontWeight: '700' },

    body: { flex: 1 },
    area: { flex: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },

    // The frame and shutter travel together and are centred as a unit.
    group: { alignItems: 'center', justifyContent: 'center' },
    groupRow: { flexDirection: 'row' },

    frame: {
      borderRadius: 16, overflow: 'hidden',
      backgroundColor: '#000', borderWidth: 1.5, borderColor: t.iconBorder,
      alignItems: 'center', justifyContent: 'center',
    },

    // Sideways "camera off" panel. Fills the frame, so nothing behind shows.
    turnPanel: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000',
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
    },
    turnGlyph: { fontSize: t.uit(32), color: '#fff', marginBottom: 10 },
    turnTitle: { fontSize: t.uit(17), fontWeight: '700', color: '#fff', textAlign: 'center' },
    turnSub: { fontSize: t.uit(12), color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 6 },

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

    // Upright: directly beneath the frame, one gap away.
    shutterRow: { alignItems: 'center', justifyContent: 'center', marginTop: FRAME_GAP },
    // Sideways: right-aligned in its column so the button hugs the frame's edge.
    shutterCol: {
      width: SHUTTER_COL_W, flexDirection: 'row',
      alignItems: 'center', justifyContent: 'flex-end',
      marginRight: FRAME_GAP,
    },
    colSpacer: { width: SHUTTER_COL_W, marginLeft: FRAME_GAP },
    // The rotated label lays out at its natural width inside a narrow slot; the
    // quarter turn then makes it tall and thin. Overflow past the slot is fine.
    hintSlot: { width: 34, height: 170, alignItems: 'center', justifyContent: 'center' },
    hintRotated: {
      width: 170, textAlign: 'center',
      fontSize: t.uit(13), fontWeight: '600', color: t.muted,
      transform: [{ rotate: '90deg' }],
    },
    shutterOuter: {
      width: 74, height: 74, borderRadius: 999, borderWidth: 4, borderColor: t.iconBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    shutterInner: { width: 58, height: 58, borderRadius: 999, backgroundColor: t.tabIdleBg },
  });
}
