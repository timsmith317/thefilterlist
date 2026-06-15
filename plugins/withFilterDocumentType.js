/**
 * withFilterDocumentType.js — Expo config plugin.
 *
 * Bundles the .filter document-type icon (FilterDoc.png / @2x / @3x) into the
 * iOS app so CFBundleTypeIconFiles can find it. The UTI + document-type
 * *declarations* live in app.config.js under ios.infoPlist — this plugin only
 * handles the part Expo can't do alone: copying loose native resources into the
 * generated Xcode project and wiring them into "Copy Bundle Resources".
 *
 * Source PNGs live at assets/filter-doc-icon/. To change the icon, just replace
 * those three files (square art; iOS frames it as a document page) and rebuild.
 *
 * After adding/changing this, you MUST regenerate native code:
 *   npx expo prebuild --clean      (local)   — or just run an EAS build.
 */
const {
  withXcodeProject,
  withDangerousMod,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SRC_DIR = 'assets/filter-doc-icon';
const ICON_FILES = ['FilterDoc.png', 'FilterDoc@2x.png', 'FilterDoc@3x.png'];

const withFilterDocumentType = (config) => {
  // 1) Copy the PNGs into ios/<ProjectName>/ during prebuild so the files the
  //    Xcode project references actually exist on disk.
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const { projectRoot, platformProjectRoot } = cfg.modRequest;
      const srcDir = path.join(projectRoot, SRC_DIR);
      // Copy into the ios/ root, NOT ios/<ProjectName>/. The resource reference
      // added below resolves against the main app group, which is a logical
      // group with no folder path -> Xcode looks for these at the ios/ root.
      const destDir = platformProjectRoot;
      for (const f of ICON_FILES) {
        const src = path.join(srcDir, f);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(destDir, f));
        } else {
          console.warn(`[withFilterDocumentType] missing icon source: ${src}`);
        }
      }
      return cfg;
    },
  ]);

  // 2) Register each PNG as a bundled resource. We use Expo's helper rather than
  //    project.addResourceFile() — the raw xcode lib tries to resolve a
  //    "Resources" PBXGroup that doesn't exist in Expo projects and throws
  //    "Cannot read properties of null (reading 'path')".
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const groupName = cfg.modRequest.projectName; // main app group == project name
    for (const f of ICON_FILES) {
      if (!project.hasFile(f)) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath: f,        // basename; the file lives in the group's own dir
          groupName,
          project,
          isBuildFile: true,  // also add to Copy Bundle Resources
        });
      }
    }
    return cfg;
  });

  return config;
};

module.exports = withFilterDocumentType;
