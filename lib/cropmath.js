// lib/cropmath.js — pure geometry for the photo cropper. No RN/native imports
// so it can be unit-tested in plain node.
//
// Model: a 3:4 PORTRAIT crop frame of width FW × height FH (screen px, FH =
// FW*4/3) is centered at the origin. The image (natural size iw×ih) is drawn
// centered, scaled by baseScale so that at userScale = 1 the WHOLE image fits
// inside the frame (contain). The user can zoom IN (userScale > 1) and pan
// (tx, ty = the image center's offset from the frame center, in screen px).
//
// baseScale = min(FW/iw, FH/ih) → at userScale 1 the whole image fits (contain).
//
// computeCropRect maps the frame back into source-image pixels and clamps to the
// image bounds. Zooming in yields a 3:4 region of the source. At userScale 1 on
// an image whose aspect differs from 3:4, the clamp yields the whole image on
// the limiting axis (the crop is never larger than the image).
//
// API: the frame is passed as its WIDTH (F). Height is derived as F*4/3 via
// frameHeightFor. This keeps callers simple (they track one number, the width).

export const CROP_ASPECT_W = 3;
export const CROP_ASPECT_H = 4;

// Portrait height for a given frame width.
export function frameHeightFor(F) {
  return (F * CROP_ASPECT_H) / CROP_ASPECT_W;
}

// CONTAIN scale: largest scale at which the whole image fits inside FW×FH. This
// is the DISPLAY base — the image is laid out at baseScale*iw × baseScale*ih.
export function baseScaleFor(iw, ih, F) {
  const FW = F;
  const FH = frameHeightFor(F);
  return Math.min(FW / iw, FH / ih);
}

// Minimum userScale that makes the image COVER the 3:4 frame (no empty edges).
// Kept for reference / potential future use.
export function minCoverScale(iw, ih, F) {
  const FW = F;
  const FH = frameHeightFor(F);
  const contain = Math.min(FW / iw, FH / ih);
  const cover = Math.max(FW / iw, FH / ih);
  return cover / contain; // >= 1
}

// START userScale that fits the image to the frame's WIDTH: the full width of
// the photo is visible (nothing cut off the sides), height scales to match.
// A wide photo overflows top/bottom (pan vertically to choose); a tall/square
// photo shows with bars top/bottom (whole image visible, zoom in if wanted).
// This is the auto-fit start — the user pans/zooms freely from here. Expressed
// as a userScale relative to the contain baseScale (baseScale * this = width/iw).
export function fitWidthScale(iw, ih, F) {
  const FW = F;
  const FH = frameHeightFor(F);
  const contain = Math.min(FW / iw, FH / ih);
  const fitW = FW / iw;        // scale so image width == frame width
  return fitW / contain;
}

// Largest pan (screen px) allowed on each axis so the frame stays over image
// pixels when the image covers the frame; 0 (centered) when it doesn't.
export function panBounds(iw, ih, F, userScale) {
  const FW = F;
  const FH = frameHeightFor(F);
  const eff = baseScaleFor(iw, ih, F) * userScale;
  const dispW = iw * eff;
  const dispH = ih * eff;
  return {
    x: Math.max(0, (dispW - FW) / 2),
    y: Math.max(0, (dispH - FH) / 2),
  };
}

export function clampPan(tx, ty, iw, ih, F, userScale) {
  const b = panBounds(iw, ih, F, userScale);
  return {
    tx: Math.max(-b.x, Math.min(b.x, tx)),
    ty: Math.max(-b.y, Math.min(b.y, ty)),
  };
}

// Returns { originX, originY, width, height } in source-image pixels, clamped
// to [0,iw]×[0,ih]. Suitable directly for expo-image-manipulator's crop.
export function computeCropRect(iw, ih, F, userScale, tx, ty) {
  const FW = F;
  const FH = frameHeightFor(F);
  const eff = baseScaleFor(iw, ih, F) * userScale; // screen px per image px
  const dispW = iw * eff;
  const dispH = ih * eff;

  // Image's top-left on screen (frame centered at origin):
  const imgLeft = tx - dispW / 2;
  const imgTop = ty - dispH / 2;

  // Frame spans [-FW/2, FW/2] × [-FH/2, FH/2]. Frame edges → image px.
  const cropX = (-FW / 2 - imgLeft) / eff;
  const cropY = (-FH / 2 - imgTop) / eff;
  const cropW = FW / eff;
  const cropH = FH / eff;

  const x0 = Math.max(0, Math.min(iw, cropX));
  const y0 = Math.max(0, Math.min(ih, cropY));
  const x1 = Math.max(0, Math.min(iw, cropX + cropW));
  const y1 = Math.max(0, Math.min(ih, cropY + cropH));

  return {
    originX: Math.round(x0),
    originY: Math.round(y0),
    width: Math.round(x1 - x0),
    height: Math.round(y1 - y0),
  };
}
