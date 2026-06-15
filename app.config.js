/**
 * app.config.js — dynamic Expo config for The Filter List.
 * Mirrors the Hanger pattern via APP_VARIANT.
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
          'The Filter List uses the camera so you can snap a reference photo of a filter or part.',
        NSPhotoLibraryUsageDescription:
          'The Filter List can attach photos from your library as part references.',
        NSPhotoLibraryAddUsageDescription:
          'The Filter List can save reference photos to your Photos library.',

        // --- Custom ".filter" backup document type ---
        // Declares the app as the owner/handler of .filter files: gives them a
        // real type name, branded icon, and clean "Open in The Filter List" /
        // AirDrop routing instead of a generic document.
        CFBundleDocumentTypes: [
          {
            CFBundleTypeName: 'Filter List Backup',
            LSHandlerRank: 'Owner',
            LSItemContentTypes: ['app.thefilterlist.backup'],
            CFBundleTypeIconFiles: ['FilterDoc'],
          },
        ],
        UTExportedTypeDeclarations: [
          {
            UTTypeIdentifier: 'app.thefilterlist.backup',
            UTTypeDescription: 'Filter List Backup',
            // Backups are JSON, so conform to public.json (which is also
            // public.data). Quick Look can then text-preview them. If you'd
            // rather suppress preview of the large file, use ['public.data'].
            UTTypeConformsTo: ['public.json'],
            UTTypeTagSpecification: {
              'public.filename-extension': ['filter'],
              'public.mime-type': ['application/json'],
            },
          },
        ],
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
      './plugins/withFilterDocumentType',
      'expo-router',
      'expo-notifications',
      'expo-image-picker',
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
