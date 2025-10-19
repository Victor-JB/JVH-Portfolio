import os
import logging
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from PIL import Image, ImageDraw
from pathlib import Path

# Setup logging
logger = logging.getLogger(os.getenv("APP_LOGGER"))

# Router for vision endpoints
router = APIRouter()

# Constants
GROUND_SAM_URL = "http://groundedsam:9000/infer"


def draw_boxes(img: Image.Image, boxes):
    """Draw bounding boxes on image"""
    draw = ImageDraw.Draw(img)
    for b in boxes:
        xyxy = b.xyxy[0].tolist()  # [x1,y1,x2,y2]
        draw.rectangle(xyxy, outline="red", width=4)
    return img


# ---------------------------------------------------------------------------- #
@router.post("/yolo")
async def infer_yolo(file: UploadFile = File(...)):
    """YOLO object detection endpoint"""
    if not file.filename.lower().endswith((".png", ".jpg", ".jpeg")):
        return JSONResponse(status_code=400, content={"error": "Invalid file type"})

    img_bytes = await file.read()
    img = Image.open(BytesIO(img_bytes)).convert("RGB")

    logger.debug("YOLO inference on image size: %s", img.size)

    # TODO: Replace with actual YOLO inference
    """
    boxes, confs = run_onnx(img)
    count = len(boxes)
    mean_conf = float(np.mean(confs)) if confs.size else 0.0
    """

    # Placeholder results
    count = 1
    mean_conf = 0.75

    # Return image with metadata in headers
    buf = BytesIO()
    img.save(buf, "JPEG", quality=85)
    buf.seek(0)

    headers = {
        "X-Objects-Count": str(count),
        "X-Mean-Conf": f"{mean_conf:.3f}",
        "X-Processing-Time": "150ms",  # Add processing time
    }

    return StreamingResponse(buf, media_type="image/jpeg", headers=headers)


# ---------------------------------------------------------------------------- #
@router.post("/dino-sam")
async def infer_dino_sam(file: UploadFile = File(...)):
    """DINO-SAM segmentation endpoint"""
    if not file.filename.lower().endswith((".png", ".jpg", ".jpeg")):
        return JSONResponse(status_code=400, content={"error": "Invalid file type"})

    img_bytes = await file.read()
    img = Image.open(BytesIO(img_bytes)).convert("RGB")

    logger.debug("DINO-SAM inference on image size: %s", img.size)

    # TODO: Replace with actual GroundedSAM call
    """
    res = requests.post(
        GROUND_SAM_URL,
        files={"image": ("img.jpg", img_bytes, "image/jpeg")},
        data={"prompt": prompt},
        timeout=60
    )
    if res.status_code != 200:
        raise HTTPException(500, "GroundedSAM service failed")
    """

    # Placeholder results
    count = 1
    mean_conf = 0.75

    buf = BytesIO()
    img.save(buf, "JPEG", quality=85)
    buf.seek(0)

    headers = {
        "X-Objects-Count": str(count),
        "X-Mean-Conf": f"{mean_conf:.3f}",
        "X-Segmentation-Quality": "high",
    }

    return StreamingResponse(buf, media_type="image/jpeg", headers=headers)


# ---------------------------------------------------------------------------- #
@router.get("/health")
async def vision_health():
    """Vision system health check"""
    return {
        "status": "healthy",
        "models": {
            "yolo": "loaded",  # TODO: Check actual model status
            "dino_sam": "available",
        },
        "gpu_available": False,  # TODO: Check GPU availability
        "processing_queue": 0,
    }
