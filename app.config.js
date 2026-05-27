/**
 * app.config.js — dynamic Expo config for The Filter List.
 * Mirrors the Hanger pattern: APP_VARIANT (set per EAS profile in eas.json)
 * selects the Bundle ID and display name so dev / preview / production can
 * coexist on the same device.
 *
 * Appearance: automatic light/dark. The design-token module defines both
 * palettes; the system setting selects which is active.
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
        NSCameraUsageDescription:
          'The Filter List uses the camera so you can snap a reference photo of a filter.',
        NSPhotoLibraryUsageDescription:
          'The Filter List can attach a photo from your library as a filter reference.',
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
      edgeToEdgeEnabled: true,
    },
    plugins: [
      'expo-router',
      'expo-notifications',
      'expo-image-picker',
      'expo-file-system',
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