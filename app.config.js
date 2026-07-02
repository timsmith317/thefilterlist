/**
 * app.config.js — dynamic Expo config for The Filter List. CNG project:
 * the native ios/ and android/ folders are generated from THIS file on every
 * build and are git-ignored (never committed). This file is the single source
 * of truth for identity and native config.
 *
 * VARIANTS: APP_VARIANT (set per build) selects bundle id + display name, so
 * dev / preview / production install side-by-side as three separate apps.
 *   APP_VARIANT=development  -> app.thefilterlist.app.dev     "Filter List Dev"
 *   APP_VARIANT=preview      -> app.thefilterlist.app.preview "Filter List Preview"
 *   (unset)                  -> app.thefilterlist.app         "The Filter List"
 *
 * PERMISSIONS — camera + photos only, NO microphone:
 *   This app photographs filters/parts and picks reference images; it never
 *   records audio. Two libraries add native perms:
 *     - react-native-vision-camera (camera capture) — pinned with
 *       enableMicrophonePermission:false; does not add a mic key.
 *     - expo-image-picker (library picks) — Expo AUTO-APPLIES its config plugin
 *       just because the package is installed, and with no options it injects a
 *       default NSMicrophoneUsageDescription. We list it explicitly with
 *       microphonePermission:false so its permission plugin OMITS the mic key
 *       (its createPermissionsPlugin treats false as "remove"; run-once dedup
 *       makes our explicit options win over the auto-application).
 *   Net: no mic key. After prebuild, verify with grep -c on the generated
 *   Info.plist (expect 0), and grep -c NSCameraUsageDescription (expect 1).
 */
const variant = process.env.APP_VARIANT;
const IS_DEV = variant === 'development';
const IS_PREVIEW = variant === 'preview';

function getAppName() {
  if (IS_DEV) return 'Filter List Dev';
  if (IS_PREVIEW) return 'Filter List Preview';
  return 'The Filter List';
}
function getBundleId() {
  if (IS_DEV) return 'app.thefilterlist.app.dev';
  if (IS_PREVIEW) return 'app.thefilterlist.app.preview';
  return 'app.thefilterlist.app';
}

// Single copy of each usage string so config and any consumer can't drift.
const CAMERA_PERMISSION =
  'The Filter List needs access to your camera to photograph a filter or part for reference.';
const PHOTOS_PERMISSION =
  'The Filter List lets you add a reference photo of a filter from your photo library — for example, choosing an existing picture of a cartridge to catalog it.';
const PHOTOS_ADD_PERMISSION =
  "The Filter List can save a filter's reference photo to your library — for example, exporting a picture of a cartridge to keep or share outside the app.";

module.exports = {
  expo: {
    name: getAppName(),
    slug: 'thefilterlist',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'thefilterlist',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: getBundleId(),
      // We set the permission strings here directly (not via plugins), so the
      // generated plist carries exactly these three keys — camera, photo-read,
      // photo-add — and no microphone key.
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: CAMERA_PERMISSION,
        NSPhotoLibraryUsageDescription: PHOTOS_PERMISSION,
        NSPhotoLibraryAddUsageDescription: PHOTOS_ADD_PERMISSION,
      },
    },
    android: {
      package: getBundleId(),
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
        backgroundColor: '#ffffff',
      },
    },
    plugins: [
      'expo-router',
      'expo-notifications',
      // Camera capture (components/CameraCaptureModal). Pinned exactly like
      // Hanger: no microphone, no location. This plugin does NOT inject a mic
      // usage string — that's the whole reason we moved off expo-camera.
      [
        'react-native-vision-camera',
        {
          cameraPermissionText: CAMERA_PERMISSION,
          enableMicrophonePermission: false,
          enableLocation: false,
        },
      ],
      // expo-image-picker (library picks via pickFromLibrary). It is auto-applied
      // by Expo because it's a dependency, and WITHOUT options it injects a
      // default NSMicrophoneUsageDescription (the mic key we kept seeing). Listed
      // explicitly here with microphonePermission:false so its permission plugin
      // OMITS the mic key — image-picker's createPermissionsPlugin treats false as
      // "remove" (unlike expo-camera, which ignored it). photosPermission/
      // cameraPermission strings mirror infoPlist for consistency.
      [
        'expo-image-picker',
        {
          photosPermission: PHOTOS_PERMISSION,
          cameraPermission: CAMERA_PERMISSION,
          microphonePermission: false,
        },
      ],
      'expo-file-system',
      'expo-sharing',
      'expo-font',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '70ab2f1f-e420-449d-9ec3-774efaefe35e',
      },
      appVariant: variant || 'production',
    },
  },
};
