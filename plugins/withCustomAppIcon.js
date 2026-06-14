/**
 * withCustomAppIcon.js — Expo config plugin for The Filter List.
 *
 * Expo's `icon` field produces a single 1024px master that iOS then downscales
 * to every display size at render time. For an icon built from long horizontal
 * edges, that downscale lands edges on fractional pixels and reads as fuzzy.
 *
 * This plugin replaces the generated AppIcon.appiconset with a hand-tuned,
 * pixel-snapped multi-size set so iOS uses our exact pixels at each size with
 * no downscaling. It runs as a dangerous mod in the iOS phase, after Expo's own
 * icon step, so it overwrites the regenerated set on every prebuild (including
 * `prebuild --clean` and EAS builds).
 *
 * Source set lives at: assets/AppIcon.appiconset/
 *   - icon-40.png, icon-58.png, icon-60.png, icon-80.png,
 *     icon-87.png, icon-120.png, icon-180.png, icon-1024.png
 *   - Contents.json
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Path to the hand-tuned icon set, relative to the project root.
const SOURCE_DIR = path.join('assets', 'AppIcon.appiconset');

// Recursively locate the generated AppIcon.appiconset under ios/.
// (The containing folder name varies by APP_VARIANT: FilterListDev,
// FilterListPreview, TheFilterList — so we search instead of hardcoding.)
function findAppIconSet(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'AppIcon.appiconset') return full;
      const found = findAppIconSet(full);
      if (found) return found;
    }
  }
  return null;
}

module.exports = function withCustomAppIcon(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, SOURCE_DIR);
      if (!fs.existsSync(src)) {
        throw new Error(`[withCustomAppIcon] source folder not found: ${src}`);
      }

      const dest = findAppIconSet(cfg.modRequest.platformProjectRoot);
      if (!dest) {
        throw new Error('[withCustomAppIcon] AppIcon.appiconset not found under ios/');
      }

      // Wipe the generated set and replace it with ours.
      fs.rmSync(dest, { recursive: true, force: true });
      fs.mkdirSync(dest, { recursive: true });
      for (const file of fs.readdirSync(src)) {
        fs.copyFileSync(path.join(src, file), path.join(dest, file));
      }

      return cfg;
    },
  ]);
};
