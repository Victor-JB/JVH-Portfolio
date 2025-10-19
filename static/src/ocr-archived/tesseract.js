/* tesseract.js  ------------------------------------------------------------ */

import { OCR_SCREEN_CONFIG } from '../config.js';
import { detectAndWarpPage } from './page-detect.js';

let grabCan, grabCtx, lastHash = 0;

/*
Possible TODO: page-detect implementation:

  const warped = await detectAndWarpPage(video);
  let hit;
  if (warped) {
    hit = await tesseractWorker.recognize(warped)
                               .then(r=>r.data.text.match(/\\b00\\d{6}\\b/));
  }
*/

// ----------------------- init tesseract worker ---------------------------- //
const worker = await (async () => {
  const w = await Tesseract.createWorker('eng', 1, {
    logger: m => {
        if (m.progress == 1) {
        console.log(m);
        } 
    }
  });
  
  await w.setParameters({
    tessedit_char_whitelist: '0123456789',
    tessedit_pageseg_mode:   Tesseract.PSM_SPARSE_TEXT // PSM_AUTO_OSD, PSM_SINGLE_BLOCK, PSM_SINGLE_LINE, PSM_SPARSE_TEXT
  });
  console.log('Tesseract ready');
  return w;
})();

// ---------------------- actually run sales no. ocr ------------------------ //
export async function findSalesOrderNo(frame) {

    const tWorker = await worker;
    // make sure we have a canvas big enough for the crop
    const w = frame.videoWidth;
    const h = Math.floor(frame.videoHeight * OCR_SCREEN_CONFIG.CROP_RATIO);   // crop to top 25 %

    if (!grabCan) {
        grabCan = new OffscreenCanvas(w, h);              // use document.createElement('canvas') if Safari
        grabCtx = grabCan.getContext('2d', { alpha: false, willReadFrequently : true });
    } else if (grabCan.width !== w || grabCan.height !== h) {
        grabCan.width = w; grabCan.height = h;            // handle orientation change
    }

    if (OCR_SCREEN_CONFIG.PREPROCESS) preprocess(grabCtx);
    
    // copy the current video pixels → canvas
    grabCtx.drawImage(frame, 0, 0, w, h, 0, 0, w, h);

    // does checking if changed affect performance? doesn't really drop many frames...
    // if (!frameChanged(grabCtx)) { 
    //   console.log("skipping, already seen...");
    //   return null;
    // }

    // if (OCR_SCREEN_CONFIG.PREPROCESS) enhanceForDigits(grabCtx);
    grabCtx.filter = 'none'; // reset so guide isn’t affected next frame

    // OCR the canvas
    const { data: {text} } = await tWorker.recognize(grabCan);

    const hit = text.match(/\b00\d{6}\b/);
    // const hit = text.match(/\b^00\\d{6}$\b/);
    // console.log("smth?: ", hit)

    return hit; 
}

/* ---------------------------------------------------------
   Simple, modular pre‑processing – can be moved to its own file
   --------------------------------------------------------- */
function preprocess(ctx) {
    console.log("Applying preprocessing...");
    // The filter string is very fast: it runs on the GPU, no pixel copy
    ctx.filter = `
    grayscale(100%)              /* drop colour noise          */
    contrast(140%)               /* expand histogram           */
    brightness(110%)             /* lift under-exposed white   */
    sepia(0%)`;                  /* future hook – keep 0%      */

    // Later you could chain more: blur, threshold etc.
}

// -------------------- enhanced full-suite preprocessing ------------------- //
function enhanceForDigits(ctx) {
  /* Fast GPU filters first (cheap on iOS / Chrome) */
  console.log("Applying enhanced preprocessing...");
  ctx.filter = `
    grayscale(100%)              /* drop colour noise          */
    contrast(160%)               /* expand histogram           */
    brightness(110%)             /* lift under-exposed white   */
    sepia(0%)`;                  /* future hook – keep 0%      */

  /* Draw into a temp canvas so filter takes effect */
  const { width:w, height:h } = ctx.canvas;
  const tmp = new OffscreenCanvas(w, h);
  const tmpCtx = tmp.getContext('2d', { alpha:false });
  tmpCtx.drawImage(ctx.canvas, 0, 0);

  /* Now pull pixels and run a fast JS/typed-array pass
     for adaptive threshold + slight unsharp mask.       */
  const img  = tmpCtx.getImageData(0, 0, w, h);
  const px   = img.data;
  let sum    = 0;

  /* ❶  compute global mean for simple thresholding */
  for (let i = 0; i < px.length; i += 4) sum += px[i];      // red channel OK (grey)

  const mean = sum / (px.length / 4);

  /* ❷  threshold + very small unsharp mask */
  for (let i = 0; i < px.length; i += 4) {
    const val = px[i] > mean - 15 ? 255 : 0;                // tweak ±15 for sheet glare
    /* unsharp mask kernel centre weight 5, neighbours -1  */
    px[i] = px[i+1] = px[i+2] = val;
  }

  ctx.filter = 'none';
  ctx.putImageData(img, 0, 0);
}

// -------------------- preventing bad frame to be used again --------------- //
function frameChanged(ctx) {
  /* sample one scan-line mid-way:  256 px → 64 bytes */
  const { width:w } = ctx.canvas;
  const y = 32;                            // any row in the crop
  const line = ctx.getImageData(0, y, w, 1).data;

  /* xor hash –  4 × faster than CRC */
  let hash = 0;
  for (let i = 0; i < line.length; i += 4) hash ^= line[i];

  const changed = hash !== lastHash;
  lastHash = hash;
  return changed;
}


// ---------------------------- clean up worker ----------------------------- //
export async function disposeTesseract() {
  const w = await worker;     // ensure it exists
  w.terminate();
}