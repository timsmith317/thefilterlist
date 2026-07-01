/**
 * app.config.js — dynamic Expo config for The Filter List.
 * Mirrors the Hanger pattern via APP_VARIANT.
 *
 * SOURCE OF TRUTH: this file is what EAS uses to generate the native project
 * for each build (production ships from here). The committed ios/ folder is a
 * PREVIEW-variant artifact used for local Xcode builds only — treat it as the
 * dev/preview target, never as production. Production identity (bundle id,
 * name) is resolved here by getBundleId()/getAppName().
 *
 * PERMISSIONS — why the plugins are configured, not bare:
 *   The App Store rejects placeholder usage strings and permission keys for
 *   capabilities the app doesn't use. This app takes STILL reference photos
 *   only — it never records audio. Both expo-image-picker and expo-camera
 *   inject an NSMicrophoneUsageDescription by DEFAULT, which is exactly the
 *   orphan key that risks a 5.1.1 rejection. Configuring each plugin with an
 *   explicit permission set (and no microphone) prevents prebuild from ever
 *   re-adding that key. The infoPlist strings below are mirrored so the
 *   generated plist matches intent regardless of which mechanism writes it.
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

// Single copy of each usage string so the plugin config and the infoPlist
// block below can't drift apart.
const CAMERA_PERMISSION =
  'The Filter List needs access to your camera to photograph a filter or part for reference.';
const PHOTOS_PERMISSION =
  'The Filter List lets you add a reference photo of a filter from your photo library — for example, choosing an existing picture of a cartridge to catalog it.';
const PHOTOS_ADD_PERMISSION =
  "The Filter List can save a filter's reference photo to your library — for example, exporting a picture of a cartridge to keep or share outside the app.";

export default {
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
      // Explicit permission strings; no microphone. Prevents the default mic
      // usage string the picker would otherwise inject on prebuild.
      [
        'expo-image-picker',
        {
          photosPermission: PHOTOS_PERMISSION,
          cameraPermission: CAMERA_PERMISSION,
        },
      ],
      // KEEP THIS BLOCK ONLY IF expo-camera is a dependency in package.json.
      // If `grep expo-camera package.json` prints nothing, DELETE this entry
      // (the pod is then only transitive and this plugin id won't resolve —
      // leaving it would break prebuild). If expo-camera IS listed, keep it:
      // it's the other injector of the mic key, and recordAudioAndroid:false
      // + omitting a microphone permission is what suppresses it.
      [
        'expo-camera',
        {
          cameraPermission: CAMERA_PERMISSION,
          recordAudioAndroid: false,
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