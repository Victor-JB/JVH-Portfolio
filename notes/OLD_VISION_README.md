
<img src="static/resources/logo-nobg.png" alt="Joulin Logo" align="center" width="200">

# Shipping‑QC Vision System

A hybrid, local‑first computer‑vision workflow for verifying outgoing orders on the shipping line.  
The system prompts operators for required photos, automatically counts parts, and stores images
together with order metadata.

---

## App Structure
main.js           → Application controller & event coordination
hud-manager.js    → All HUD/UI management 
camera.js         → Camera operations & photo capture
photo-queue.js    → Data persistence & management
ux-elements.js    → Just modal & utility functions

## 📋 Function Call Flow:
User clicks shutter → main.js calls capturePhoto() 
→ camera.js captures & dispatches PHOTO_CAPTURED event
→ main.js event listener calls hudManager.onPhotoCaptured()
→ HUD updates photos and item counts

## 🔄 Complete Cycle:
Scan → HUD opens → Take photos/check items → Click Done
→ Validation passes → Upload → Clear session 
→ while loop continues → Modal shows "Waiting for scan..."
→ Ready for next barcode

## ✅ Client-Side Logging Strategy
I implemented a multi-tier posting strategy that ensures reliable log delivery:
📊 Posting Strategy:

🚨 IMMEDIATE: Critical errors sent instantly
⏰ BATCH: Regular logs sent every 30 seconds
📋 SESSION: Complete session uploaded on "Done" click
🔄 VISIBILITY: Logs flushed when user switches apps/tabs
💾 BEACON: Final logs sent during page unload (most reliable)

# 📈 Benefits:

Reliable delivery: Multiple fallback mechanisms
Performance: Batched sending reduces server load
Completeness: Captures logs even if user closes browser unexpectedly
Smart: Only sends when necessary, queues when offline

## Architecture at a Glance

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Local detector** | **YOLOv9‑Seg** exported to Core ML | Real‑time instance masks & counts on iPad (< 10 ms @ 640×640). |
| **Open‑set fallback** | **Grounding DINO 1.5 → SAM 2** | Zero‑shot detection + pixel‑perfect masks on Vercel GPU. |
| **Ultra‑dense counter** | **CSRNet** | Density‑map counting when objects are piled densely. |
| **Front‑end** | SwiftUI (production) & Next.js 14 (browser demo) | Works on shop‑floor iPads *and* any phone for quick testing. |
| **Backend / API** | FastAPI + TorchServe in Docker | Heavy models & async jobs. |
| **Storage** | S3 (MinIO/AWS) + PostgreSQL | Images in object storage, order ↔ photo rows in DB. |

---

## Objectives

1. **Photo compliance** – prompt and verify all required views.
2. **Automated counting** – instant on‑device count; cloud fallback for hard scenes.
3. **Order association** – barcode → ERP → expected SKU list; store `/customer_id/order_id/*.jpg` + JSON.

---

## Data & Training

| Model | Input | Labels | Reason |
|-------|-------|--------|--------|
| YOLOv9‑Seg | 640×640 RGB, heavy augment | Polygon masks / instance IDs | Fast; excels at small objects. |
| Grounding DINO 1.5 | Image + text prompt | None (zero‑shot) | Handles unseen SKUs without retraining. |
| SAM 2 | DINO box → SAM | None | Sharpens masks for accurate count. |
| CSRNet | 512×512 crops | Density maps | Use when parts form near‑continuous blobs. |

### Active‑Learning Loop

1. YOLO runs on device.  
2. Frames with confidence < 0.5 auto‑upload for review.  
3. Human labels only these; nightly retrain; push new Core ML OTA.

---

## Repository Layout

```
app/
├── packages/
│   ├── models/            # ONNX / Core ML binaries
│   └── api/
│       ├── yolo/          # Next.js API route → WASM YOLO
│       └── fallback/      # GPU function calling TorchServe
├── prisma/                # PostgreSQL schema
├── public/                # Static assets
└── README.md              # (this file)
```

---

## Quick Start (browser demo on Vercel)

```bash
# 1 · Create project
npx create-next-app vision-demo --typescript --app
cd vision-demo
npm i ultralytics-web @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# 2 · Add API route `app/api/infer/route.ts`
#     – runs WASM YOLO, falls back to GPU function

# 3 · Set env vars in Vercel dashboard:
#     DATABASE_URL  S3_ENDPOINT  S3_KEY  S3_SECRET  ERP_API_KEY

git init && git add . && git commit -m "init"
vercel --prod
# Open https://<your‑app>.vercel.app on your phone
```

---

## Training Scripts

### YOLOv9‑Seg Fine‑Tuning

```bash
pip install ultralytics
yolo task=segment mode=train      model=yolov9n-seg.pt      data=data/parts.yaml      imgsz=640 batch=32 epochs=60      lr0=5e-4 project=models/parts_run

# Export to Core ML
yolo mode=export format=coreml      model=models/parts_run/weights/best.pt      imgsz=640
```

### Grounding DINO 1.5 + SAM 2 Server

```bash
git clone https://github.com/IDEA-Research/GroundingDINO.git
cd GroundingDINO
pip install -r requirements.txt
python demo/grd_sam2_server.py        --dino_ckpt weights/gdino1.5_pro.pth        --sam_ckpt  weights/sam2.pth        --device cuda
# Package with TorchServe or run as a long‑living GPU function.
```

---

## Next Steps

* Integrate barcode → ERP lookup in the demo so it knows expected counts.  
* Record low‑confidence inferences to a “to‑label” queue (Label Studio).  
* Port React camera UI to SwiftUI for production iPad app.
