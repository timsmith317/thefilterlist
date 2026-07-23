// theme/Icons.js → ~/Projects/thefilterlist/theme/Icons.js
//
// Brand logo + device type icons. CROSS-PLATFORM: no expo-symbols / SF Symbols
// anywhere in this file, so every glyph renders identically on iOS and Android.
//
// WHY THE CHANGE: IconWater and IconAir were traced from SF Symbols ("humidity"
// and "fan"). SF Symbols are licensed for use within Apple-platform apps only,
// so they can't ship in the Android build. Everything now comes from Material
// Design Icons (Apache 2.0) except IconWater, which is original artwork.
//
// ICON SET:
//   IconWater  — CUSTOM. Three wave layers with a drop falling clear of them:
//                water passing through filter media. Original drawing, ours.
//   IconAir    — MDI "fan".
//   IconOther  — MDI "filter-variant". Also the fallback for any unknown name.
//   LogoMark, IconGear, IconBack — unchanged originals.
//
// TUNING KNOBS for IconWater are grouped at the top of that function.

import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { useTheme } from './theme';
import { ICON_PATHS, LEGACY_SF_MAP } from './iconPaths';

// ----- MdiIcon -----
// Generic renderer for any Material Design Icon in ICON_PATHS. All MDI glyphs
// are single filled paths on a 24x24 grid, so one component covers the set.
export function MdiIcon({ name, size = 32, color }) {
  const t = useTheme();
  const ink = color || t.iconInk || t.ink;
  const d = ICON_PATHS[name];
  if (!d) return <IconOther size={size} color={ink} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={ink} d={d} />
    </Svg>
  );
}

// ----- LogoMark -----
// Three stacked device-frame shapes. The two rear frames are brand-green
// (t.brand, theme-aware). The front frame uses the passed color (defaults to
// t.ink) so it stays readable on either background.
export function LogoMark({ size = 24, color }) {
  const t = useTheme();
  const ink = color || t.ink;
  const greenStroke = t.brand;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Path fill={greenStroke} d="M568.36,125.899v93.922l-54.105,31.288V143.634c0-5.411-4.208-7.815-8.717-5.11L203.751,312.864 c-11.423,6.913-15.932,12.324-15.932,27.353v348.075c0,4.812,3.006,6.915,7.815,4.212l94.083-54.271v63.827l-71.839,41.543 c-48.095,27.651-83.864,9.316-83.864-48.693V338.413c0-35.77,11.422-55.308,42.684-73.643L489.607,84.118 C525.377,63.678,568.36,77.806,568.36,125.899z" />
      <Path fill={greenStroke} d="M723.764,217.278v106.191l-53.804,31.115V235.012c0-5.411-4.212-7.816-9.019-4.81L359.454,404.241 c-11.724,6.914-15.932,12.324-15.932,27.354v348.38c0,4.505,3.007,6.612,7.815,3.904l104.604-60.396v63.694l-82.661,47.801 c-47.793,27.656-83.563,9.618-83.563-48.693V429.791c0-35.77,11.121-55.308,42.383-73.342L645.01,175.496 C681.081,155.056,723.764,169.184,723.764,217.278z" />
      <Path fill={ink} fillOpacity={0.95} d="M455.941,527.481v356.494c0,58.015,35.77,76.047,83.563,48.396l307.199-177.349 c34.264-19.838,43.282-38.475,43.282-75.144V314.667c0-47.792-42.682-62.221-78.751-41.781l-312.91,180.952 C467.063,471.873,455.941,491.711,455.941,527.481z M525.678,501.931l301.485-174.338c4.813-2.706,9.019-0.301,9.019,4.809 v346.575c0,14.43-3.309,20.438-15.631,27.654L517.562,881.569c-4.81,2.709-7.815,0.6-7.815-4.206V529.285 C509.746,513.955,513.954,508.846,525.678,501.931z" />
    </Svg>
  );
}

// ----- IconWater — CUSTOM (original artwork) -----
// Three wave layers; the bottom one stops short so a clear gap opens before the
// drop, which sits low and right — reading as water that has passed through the
// media and is falling clear of it.
//
// Tuning knobs:
//   STROKE   line weight of the waves
//   WAVE_Y   vertical position of each wave
//   DROP_X   horizontal centre of the drop  (raise = further right)
//   DROP_Y   apex of the drop               (raise = lower)
//   DROP_R   radius of the drop's bulb
const W_FULL  = 'c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0';   // full wave, x 3 -> 21
const W_SHORT = 'c2-1.5 4-1.5 6 0s2.3 1.2 3.2 1.4';       // stops at x ~12.2

export function IconWater({ size = 32, color }) {
  const t = useTheme();
  const ink = color || t.iconInk || t.ink;

  const STROKE = 1.9;
  const WAVE_Y = [5.2, 9.6, 14];
  const DROP_X = 17.7;
  const DROP_Y = 12.5;
  const DROP_R = 3.6;

  // Teardrop: apex at (DROP_X, DROP_Y), tapering into a circle of DROP_R.
  const taper = 6.6;
  const drop =
    `M${DROP_X} ${DROP_Y}c0 0-${DROP_R} ${taper}-${DROP_R} ${taper}` +
    `a${DROP_R} ${DROP_R} 0 1 0 ${DROP_R * 2} 0` +
    `c0-2.2-${DROP_R} -${taper}-${DROP_R} -${taper}z`;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G stroke={ink} strokeWidth={STROKE} fill="none" strokeLinecap="round">
        <Path d={`M3 ${WAVE_Y[0]}${W_FULL}`} />
        <Path d={`M3 ${WAVE_Y[1]}${W_FULL}`} />
        <Path d={`M3 ${WAVE_Y[2]}${W_SHORT}`} />
      </G>
      <Path fill={ink} d={drop} />
    </Svg>
  );
}

// ----- IconAir — MDI "fan" -----
export function IconAir({ size = 32, color }) {
  return <MdiIcon name="fan" size={size} color={color} />;
}

// ----- IconOther — MDI "filter-variant" -----
// Default glyph for the 'other' filter type, AND the fallback for any icon name
// we don't recognise (including retired SF Symbol names with no mapping).
export function IconOther({ size = 30, color }) {
  const t = useTheme();
  const ink = color || t.iconInk || t.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={ink} d={ICON_PATHS['filter-variant']} />
    </Svg>
  );
}

// ----- IconGear -----
// Default stroke uses t.inkSoft so the gear reads as a secondary control.
export function IconGear({ size = 14, color }) {
  const t = useTheme();
  const stroke = color || t.inkSoft;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

// ----- IconBack -----
export function IconBack({ size = 26, color }) {
  const t = useTheme();
  const stroke = color || t.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18 L9 12 L15 6" />
    </Svg>
  );
}

// ----- TypeIcon dispatcher -----
export function TypeIcon({ type, size = 32, color }) {
  if (type === 'water') return <IconWater size={size} color={color} />;
  if (type === 'air')   return <IconAir size={size} color={color} />;
  return <IconOther size={size} color={color} />;
}

// ----- DeviceIcon -----
// The icon shown for a DEVICE. With an explicit `iconName` we render that glyph;
// with none we fall back to the derived water/air/other glyph via `displayType`.
//
// LEGACY NAMES: icon choices saved by older iOS builds are SF Symbol names
// ('car.fill', 'refrigerator.fill', …). LEGACY_SF_MAP translates them here at
// render time, so no stored data is rewritten and old backups still restore
// correctly. Anything we still can't resolve falls back to IconOther.
export function DeviceIcon({ iconName, displayType, size = 32, color }) {
  const t = useTheme();
  const ink = color || t.iconInk || t.ink;

  if (iconName) {
    const name = LEGACY_SF_MAP[iconName] || iconName;
    if (name === 'water-layers') return <IconWater size={size} color={ink} />;
    if (ICON_PATHS[name])        return <MdiIcon name={name} size={size} color={ink} />;
    return <IconOther size={size} color={ink} />;
  }
  return <TypeIcon type={displayType} size={size} color={ink} />;
}