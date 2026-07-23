// plugins/withGradleVersion.js → ~/Projects/thefilterlist/plugins/withGradleVersion.js
//
// Pins the Gradle wrapper version during `expo prebuild`.
//
// WHY THIS EXISTS
// The prebuild template for this SDK generates a Gradle 9.x wrapper. Building
// with it fails during Gradle's configuration phase:
//
//   Class org.gradle.jvm.toolchain.JvmVendorSpec does not have member field
//   'org.gradle.jvm.toolchain.JvmVendorSpec IBM_SEMERU'
//
// IBM_SEMERU was removed in Gradle 9, and something in the React Native Gradle
// plugin chain still references it (it's not in our android/ folder — the
// reference lives upstream in node_modules, which is why grepping the generated
// project finds nothing). Gradle 8.13 still has the field, so the build works.
//
// WHY A PLUGIN AND NOT JUST EDITING THE FILE
// This is a CNG project: android/ is generated and git-ignored, so any manual
// edit to gradle-wrapper.properties is destroyed by the next
// `prebuild --clean`. EAS cloud builds run their own prebuild, so a manual edit
// never reaches them at all. Putting it here makes the pin survive both.
//
// WHEN TO REMOVE THIS
// Once the upstream IBM_SEMERU reference is fixed (an Expo SDK or React Native
// bump), delete this file and its entry in app.config.js, run
// `prebuild --clean -p android`, and confirm the build still succeeds on the
// template's default Gradle. Pinning below the template default is not a place
// you want to stay long-term.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// The only knob. Bump or remove once upstream is fixed.
const GRADLE_VERSION = '8.13';

module.exports = function withGradleVersion(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );

      if (!fs.existsSync(file)) {
        throw new Error(
          `[withGradleVersion] Expected wrapper file not found: ${file}`
        );
      }

      const before = fs.readFileSync(file, 'utf8');
      const url =
        `https\\://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip`;
      const after = before.replace(/distributionUrl=.*/, `distributionUrl=${url}`);

      if (before === after) {
        // Either already pinned, or the line shape changed upstream. Say so
        // rather than failing silently and letting the build blow up later.
        console.warn(
          `[withGradleVersion] distributionUrl unchanged — already ${GRADLE_VERSION}, or the file format changed.`
        );
      } else {
        console.log(`[withGradleVersion] Pinned Gradle wrapper to ${GRADLE_VERSION}`);
      }

      fs.writeFileSync(file, after);
      return cfg;
    },
  ]);
};
