// lib/cropmath.js — pure geometry for the photo cropper. No RN/native imports
// so it can be unit-tested in plain node.
//
// Model: a SQUARE crop frame of side `F` (screen px) is centered at the origin.
// The image (natural size iw×ih) is drawn centered, scaled by `baseScale` so
// that at userScale = 1 the WHOLE image fits inside the frame (contain). The
// user can then zoom IN (userScale > 1) and pan (tx, ty = the image center's
// offset from the frame center, in screen px).
//
// baseScale = F / max(iw, ih)  → at userScale 1, the longer side spans F.
//
// computeCropRect maps the square frame back into source-image pixels and
// clamps to the image bounds. When zoomed all the way out (userScale 1) on a
// non-square image, the frame is larger than the image on the short axis, so
// the clamp yields the WHOLE image (no forced square crop — the entire photo
// is kept). Zooming in yields a square region of the source.

export function baseScaleFor(iw, ih, F) {
  return F / Math.max(iw, ih);
}

// Largest pan (screen px) allowed on each axis so the frame stays over image
// pixels when the image covers the frame; 0 (centered) when it doesn't.
export function panBounds(iw, ih, F, userScale) {
  const eff = baseScaleFor(iw, ih, F) * userScale;
  const dispW = iw * eff;
  const dispH = ih * eff;
  return {
    x: Math.max(0, (dispW - F) / 2),
    y: Math.max(0, (dispH - F) / 2),
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
  const eff = baseScaleFor(iw, ih, F) * userScale; // screen px per image px
  const dispW = iw * eff;
  const dispH = ih * eff;

  // Image's top-left on screen (frame centered at origin):
  const imgLeft = tx - dispW / 2;
  const imgTop = ty - dispH / 2;

  // Frame spans [-F/2, F/2]. Frame-left relative to image-left → image px.
  const cropX = (-F / 2 - imgLeft) / eff;
  const cropY = (-F / 2 - imgTop) / eff;
  const cropSize = F / eff;

  const x0 = Math.max(0, Math.min(iw, cropX));
  const y0 = Math.max(0, Math.min(ih, cropY));
  const x1 = Math.max(0, Math.min(iw, cropX + cropSize));
  const y1 = Math.max(0, Math.min(ih, cropY + cropSize));

  return {
    originX: Math.round(x0),
    originY: Math.round(y0),
    width: Math.round(x1 - x0),
    height: Math.round(y1 - y0),
  };
}