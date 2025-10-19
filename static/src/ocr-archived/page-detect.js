/* page-detect.js
   Detect an A4/Letter-like sheet in a frame, deskew it, and
   return an ImageBitmap ready for Tesseract.  Falls back to
   `null` when no 4-corner contour is found.
----------------------------------------------------------------*/
const dstW = 640;                 // warped output size
const dstH = 900;                 // keep aspect ≈ A4

// ------------------------------ init openCV ------------------------------- //
/* OpenCV loader promise (top-level await if you prefer) */
function cvReady() {
  if (_cvReady) return _cvReady;
  _cvReady = new Promise(r=>{
    if (self.cv && cv.getBuildInformation) return r();
    self.Module = { onRuntimeInitialized: r };   // OpenCV.js hook
  });
  return _cvReady;
}

// -------------- detecting page and locating text of interest -------------- //
export async function detectAndWarpPage(grabCan) {
  if (!self.cv) await cvReady();  // make sure OpenCV.js is loaded

  // 1. convert to cv.Mat ----------------------------------------
  const src  = cv.imread(grabCan);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // 2. edge map + contours --------------------------------------
  const edges = new cv.Mat();
  cv.GaussianBlur(gray, gray, new cv.Size(5,5), 0);
  cv.Canny(gray, edges, 50, 150);              // tweak thresholds as needed

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy,
                  cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  // 3. find largest 4-point contour -----------------------------
  let pageCnt = null, maxArea = 0;
  for (let i = 0; i < contours.size(); ++i) {
    const c = contours.get(i);
    const peri = cv.arcLength(c, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(c, approx, 0.02 * peri, true);

    if (approx.rows === 4) {
      const area = cv.contourArea(approx);
      if (area > maxArea) { maxArea = area; pageCnt = approx; }
    }
  }

  if (!pageCnt) {                 // ← no sheet detected
    cleanup();  return null;
  }

  // 5. order the 4 points TL,TR,BR,BL ---------------------------
  const pts = [];
  for (let i = 0; i < 4; ++i) pts.push({ x:pageCnt.intAt(i,0),
                                         y:pageCnt.intAt(i,1) });
  pts.sort((a,b)=>a.x+a.y - (b.x+b.y));        // TL, BR extremes
  const [tl, br] = [pts[0], pts[3]];
  const [tr, bl] = pts[1].x < pts[2].x ? [pts[1], pts[2]] : [pts[2], pts[1]];

  const srcTri = cv.matFromArray(4,1,cv.CV_32FC2,
    [tl.x,tl.y,  tr.x,tr.y,  br.x,br.y,  bl.x,bl.y]);
  const dstTri = cv.matFromArray(4,1,cv.CV_32FC2,
    [0,0,  dstW,0,  dstW,dstH,  0,dstH]);

  // 6. perspective warp -----------------------------------------
  const M  = cv.getPerspectiveTransform(srcTri, dstTri);
  const dst = new cv.Mat();
  cv.warpPerspective(src, dst, M, new cv.Size(dstW,dstH),
                     cv.INTER_LINEAR, cv.BORDER_REPLICATE);

  // 7. To ImageBitmap (cheap, no copy) --------------------------
  const warpedCan = new OffscreenCanvas(dstW, dstH);
  cv.imshow(warpedCan, dst);
  const bitmap = await warpedCan.transferToImageBitmap();

  cleanup();  return bitmap;

  function cleanup() {
    [src, gray, edges, contours, hierarchy, pageCnt].forEach(m=>m && m.delete());
  }
}