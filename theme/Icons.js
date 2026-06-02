// theme/Icons.js — brand logo + filter type icons.
//
// LogoMark: three stacked filter frames (the brand mark).
// IconWater: SF Symbol "humidity" with stroke boost to match fan weight.
// IconAir:   SF Symbol "fan".
// IconOther: rounded square with divider (fallback type).
// IconGear, IconBack: utility icons.

import React, { useId } from 'react';
import Svg, { Path, Circle, Rect, G, Defs, Mask } from 'react-native-svg';
import { useTheme } from './theme';

// ----- LogoMark -----
// Three stacked filter-frame shapes. The two rear frames are brand-green
// (now via t.brand, theme-aware: #15803d in light, #4ade80 in dark). The
// front frame uses the passed color (defaults to t.ink) so it stays
// readable on either background.
export function LogoMark({ size = 24, color }) {
  const t = useTheme();
  const ink = color || t.ink;
  const greenStroke = t.brand;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Path fill={greenStroke} d="M568.36,125.899v93.922l-54.105,31.288V143.634c0-5.411-4.208-7.815-8.717-5.11L203.751,312.864 c-11.423,6.913-15.932,12.324-15.932,27.353v348.075c0,4.812,3.006,6.915,7.815,4.212l94.083-54.271v63.827l-71.839,41.543 c-48.095,27.651-83.864,9.316-83.864-48.693V338.413c0-35.77,11.422-55.308,42.684-73.643L489.607,84.118 C525.377,63.678,568.36,77.806,568.36,125.899z"/>
      <Path fill={greenStroke} d="M723.764,217.278v106.191l-53.804,31.115V235.012c0-5.411-4.212-7.816-9.019-4.81L359.454,404.241 c-11.724,6.914-15.932,12.324-15.932,27.354v348.38c0,4.505,3.007,6.612,7.815,3.904l104.604-60.396v63.694l-82.661,47.801 c-47.793,27.656-83.563,9.618-83.563-48.693V429.791c0-35.77,11.121-55.308,42.383-73.342L645.01,175.496 C681.081,155.056,723.764,169.184,723.764,217.278z"/>
      <Path fill={ink} fillOpacity={0.95} d="M455.941,527.481v356.494c0,58.015,35.77,76.047,83.563,48.396l307.199-177.349 c34.264-19.838,43.282-38.475,43.282-75.144V314.667c0-47.792-42.682-62.221-78.751-41.781l-312.91,180.952 C467.063,471.873,455.941,491.711,455.941,527.481z M525.678,501.931l301.485-174.338c4.813-2.706,9.019-0.301,9.019,4.809 v346.575c0,14.43-3.309,20.438-15.631,27.654L517.562,881.569c-4.81,2.709-7.815,0.6-7.815-4.206V529.285 C509.746,513.955,513.954,508.846,525.678,501.931z"/>
    </Svg>
  );
}

// ----- IconWater -----
// SF Symbol "humidity" (Regular weight). Three wavy lines with a drop
// integrated into the bottom wave. Uses a mask to punch a hole in the
// bottom wave so the drop appears in front cleanly.
//
// BOOST adds a thin stroke on top of the fills to match the fan icon's
// visual weight. Tweak the value to taste: try 1.0 first, go up or down
// from there. 0 = pure Regular SF Symbol weight.
//
// useId() gives each instance a unique mask ID, so multiple humidity icons
// on the same screen don't conflict.
//
// IMPORTANT: SF Symbols are licensed for in-app use within iOS apps. Don't
// use them in marketing, app icons, or merchandise.
export function IconWater({ size = 32, color }) {
  const t = useTheme();
  const ink = color || t.iconInk || t.ink;
  const maskId = useId();
  const BOOST = 1; // line-weight tuning knob (0 = Regular SF; try 1.0 to match fan)
  return (
    <Svg width={size} height={size} viewBox="-2 -80 102 90">
      <Defs>
        <Mask id={maskId} maskUnits="userSpaceOnUse" x="-2" y="-80" width="102" height="90">
          <Rect x="-2" y="-80" width="102" height="90" fill="white"/>
          <Path d="M75.9277 6.54297C88.2812 6.54297 98.291-3.22266 98.291-15.4297C98.291-21.875 95.2148-27.832 93.1152-31.8848L84.7168-47.5098C82.8125-51.0254 80.0781-53.1738 75.9277-53.1738C71.8262-53.1738 69.0918-51.0254 67.1875-47.5098L58.8379-31.8359C56.7383-27.832 53.6133-21.875 53.6133-15.4297C53.6133-3.22266 63.623 6.54297 75.9277 6.54297Z" fill="black"/>
        </Mask>
      </Defs>
      <G mask={`url(#${maskId})`}>
        <Path fill={ink} stroke={ink} strokeWidth={BOOST} strokeLinecap="round" strokeLinejoin="round" d="M25.6348-4.00391C42.9688-4.00391 52.002-18.457 68.0664-18.457C71.6309-18.457 74.9023-17.6758 78.8086-15.4297C80.6152-14.3555 82.373-15.0879 83.3008-16.4062C84.375-17.9199 84.2773-20.3125 81.7871-21.7773C77.4902-24.2676 72.9492-25.4883 68.0664-25.4883C50.6348-25.4883 41.6504-11.0352 25.6348-11.0352C22.0703-11.0352 18.7988-11.8164 14.8926-14.0625C13.0859-15.1367 11.2793-14.4043 10.4004-13.0371C9.375-11.4746 9.47266-9.08203 11.8652-7.71484C16.1621-5.22461 20.752-4.00391 25.6348-4.00391Z"/>
        <Path fill={ink} stroke={ink} strokeWidth={BOOST} strokeLinecap="round" strokeLinejoin="round" d="M25.6836-24.5117C43.0176-24.5117 52.0508-38.9648 68.1152-38.9648C71.6797-38.9648 74.9512-38.1836 78.8574-35.9375C80.6641-34.8633 82.4219-35.5957 83.3496-36.9141C84.4238-38.4277 84.3262-40.8203 81.8359-42.2852C77.5391-44.7754 72.998-45.9961 68.1152-45.9961C50.6836-45.9961 41.6992-31.543 25.6836-31.543C22.1191-31.543 18.8477-32.3242 14.9414-34.5703C13.0859-35.6445 11.3281-34.9121 10.4492-33.5449C9.42383-31.9824 9.47266-29.5898 11.9141-28.2227C16.2109-25.7324 20.8008-24.5117 25.6836-24.5117Z"/>
        <Path fill={ink} stroke={ink} strokeWidth={BOOST} strokeLinecap="round" strokeLinejoin="round" d="M25.6348-45.0195C42.9688-45.0195 52.002-59.4727 68.0664-59.4727C71.6309-59.4727 74.9023-58.6914 78.8086-56.4453C80.6152-55.3711 82.373-56.1035 83.3008-57.4219C84.375-58.9355 84.2773-61.3281 81.7871-62.793C77.4902-65.2832 72.9492-66.5039 68.0664-66.5039C50.6348-66.5039 41.6504-52.0508 25.6348-52.0508C22.0703-52.0508 18.7988-52.832 14.8926-55.0781C13.0859-56.1523 11.2793-55.4199 10.4004-54.0527C9.375-52.4902 9.47266-50.0977 11.8652-48.7305C16.1621-46.2402 20.752-45.0195 25.6348-45.0195Z"/>
      </G>
      <Path fill={ink} stroke={ink} strokeWidth={BOOST} strokeLinecap="round" strokeLinejoin="round" d="M75.9277 0.830078C85.2051 0.830078 92.627-6.44531 92.627-15.4297C92.627-20.4102 90.1367-25.293 88.0371-29.1992L79.6387-44.7754C78.6621-46.6309 77.7832-47.4609 75.9277-47.4609C74.0723-47.4609 73.1934-46.6309 72.2168-44.7754L63.8672-29.1992C61.8164-25.293 59.3262-20.4102 59.3262-15.4297C59.3262-6.44531 66.748 0.830078 75.9277 0.830078ZM75.9277-4.88281C69.873-4.88281 65.0391-9.52148 65.0391-15.4297C65.0391-19.0918 66.8945-22.6074 68.9453-26.5137L75.6348-38.916C75.8301-39.2578 76.123-39.2578 76.3184-38.916L82.9102-26.5137C84.9609-22.6074 86.9141-19.0918 86.9141-15.4297C86.9141-9.52148 82.0312-4.88281 75.9277-4.88281Z"/>
    </Svg>
  );
}

// ----- IconAir -----
// Apple SF Symbol "fan" (Regular weight). Single fill path in SF Symbols
// baseline-anchored coordinate space — viewBox shifted to fit.
// IMPORTANT: SF Symbols are licensed for in-app use within iOS apps.
// They may not be used in marketing materials, app icons, or t-shirts etc.
export function IconAir({ size = 32, color }) {
  const t = useTheme();
  const ink = color || t.iconInk || t.ink;
  return (
    <Svg width={size} height={size} viewBox="0 -85 105 95">
      <Path fill={ink} d="M48.5352-46.9238L48.5352-65.5762C48.5352-72.9004 44.6289-76.8555 37.5977-76.8555C25.1953-76.8066 12.1582-65.5273 12.1582-54.834C12.1582-44.6777 21.8262-39.1113 37.8418-33.3008L40.7227-39.6484C26.709-44.7754 18.8477-48.1934 18.8477-54.834C18.8477-61.9141 28.8574-70.166 37.5977-70.166C40.918-70.166 41.7969-69.1895 41.7969-65.5762L41.7969-44.9219ZM63.0371-38.1348L81.6895-38.1348C88.9648-38.1348 92.9199-41.9434 92.9199-48.9746C92.9199-61.377 81.6406-74.4629 70.8984-74.4629C60.791-74.4629 55.1758-64.7461 49.4141-48.7305L55.7617-45.8496C60.8887-59.8633 64.2578-67.7734 70.8984-67.7734C77.9785-67.7734 86.2793-57.7148 86.2793-48.9746C86.2793-45.6543 85.3027-44.8242 81.6895-44.8242L60.9863-44.8242ZM54.1992-23.584L54.1992-4.93164C54.1992 2.39258 58.0078 6.34766 65.0879 6.34766C77.4414 6.34766 90.5273-4.93164 90.5273-15.6738C90.5273-25.7812 80.8105-31.3965 64.7949-37.1582L61.9141-30.8594C75.9277-25.7324 83.8379-22.3145 83.8379-15.6738C83.8379-8.59375 73.7793-0.292969 65.0879-0.341797C61.7188-0.341797 60.8887-1.26953 60.8887-4.93164L60.8887-25.5859ZM39.6484-32.4219L20.9961-32.4219C13.6719-32.4219 9.76562-28.5645 9.76562-21.5332C9.76562-9.13086 21.0449 3.95508 31.7383 3.95508C41.8945 3.95508 47.4609-5.76172 53.2715-21.7773L46.9238-24.6582C41.7969-10.6445 38.3789-2.7832 31.7383-2.7832C24.707-2.7832 16.4551-12.793 16.4551-21.5332C16.4551-24.8535 17.3828-25.7324 20.9961-25.7324L41.6504-25.7324ZM51.3184-20.4102C59.5215-20.4102 66.1621-27.0508 66.1621-35.2539C66.1621-43.457 59.5215-50.0977 51.3184-50.0977C43.1152-50.0977 36.4746-43.457 36.4746-35.2539C36.4746-27.0508 43.1152-20.4102 51.3184-20.4102ZM51.3184-27.1484C46.8262-27.1484 43.2129-30.7617 43.2129-35.2539C43.2129-39.7461 46.8262-43.3594 51.3184-43.3594C55.8105-43.3594 59.4238-39.7461 59.4238-35.2539C59.4238-30.7617 55.8105-27.1484 51.3184-27.1484ZM51.3184-29.7852C54.3457-29.7852 56.7871-32.2266 56.7871-35.2539C56.7871-38.2812 54.3457-40.7227 51.3184-40.7227C48.291-40.7227 45.8496-38.2812 45.8496-35.2539C45.8496-32.2266 48.291-29.7852 51.3184-29.7852Z"/>
    </Svg>
  );
}

// ----- IconOther — rounded square with divider -----
export function IconOther({ size = 30, color }) {
  const t = useTheme();
  const ink = color || t.iconInk || t.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={2.1}>
      <Rect x="4" y="4" width="16" height="16" rx="3" />
      <Path d="M4 12h16" />
    </Svg>
  );
}

// ----- IconGear -----
// Now theme-aware. Default stroke uses t.inkSoft so the gear reads as a
// secondary control rather than a primary one. Callers can still pass an
// explicit `color` to override.
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
// Now theme-aware. Default stroke uses t.ink so it reads as a primary
// navigation control. Callers can pass `color` to override.
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
export function TypeIcon({ type, size = 32, color, bg }) {
  if (type === 'water') return <IconWater size={size} color={color} />;
  if (type === 'air')   return <IconAir size={size} color={color} />;
  return <IconOther size={size} color={color} />;
}