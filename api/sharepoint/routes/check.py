import os
from typing import List
import logging
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query

from ..graph_http import graph_http
from ..schemas import GraphRequest, CheckResponse, FileEntry

router = APIRouter()
logger = logging.getLogger(os.getenv("APP_LOGGER"))

DRIVE_ID = os.getenv("GRAPH_DRIVE_ID", "").strip()
ROOT_PATH = os.getenv("GRAPH_ROOT_PATH", "").strip("/")


@router.get("/check", response_model=CheckResponse)
async def check_order_folder(
    customer: str = Query(..., min_length=1, max_length=120),
    order_no: str = Query(..., min_length=1, max_length=120),
):
    """
    Checks for the existence of a specific order folder within a SharePoint drive,
    and returns its immediate children.
    """

    # --- 1. Construct the folder path ---
    customer_seg = customer.strip()
    order_customer_seg = (f"{order_no}.{customer}").strip()

    path_segments = [s for s in [ROOT_PATH, customer_seg, order_customer_seg] if s]
    target_path = "/".join(path_segments)

    logger.info(f"[/CHECK] Target path for checking sp folder existence: {target_path}")

    # --- 2. Build the API request to find and expand the folder ---
    # Only encode the full path here, right before using it in the endpoint.
    encoded_path = quote(target_path)
    endpoint = (
        f"/drives/{DRIVE_ID}/root:/{encoded_path}"
        "?$select=id,name,webUrl,folder"
        "&$expand=children($select=id,name,size,webUrl,file,folder)"
    )

    try:
        resp = await graph_http(
            GraphRequest(
                method="GET",
                endpoint=endpoint,
                timeout_ms=6000,
                max_retries=3,
                raise_for_status=False,
            )
        )
    except Exception as e:
        logger.error(f"[/CHECK] SharePoint request failed: {e}")
        raise HTTPException(status_code=502, detail=f"SharePoint request failed: {e}")

    # --- 3. Handle different response statuses ---
    # Handle 404 specifically for a clean "not found" result.
    if resp.status_code == 404:
        logger.info(f"[/CHECK] Folder not found for path: {target_path}")
        return CheckResponse(
            ok=True,
            customer=customer,
            order_no=order_no,
            folder_exists=False,
            has_photos=False,
            photo_count=0,
            files=[],
        )

    # Handle other non-success status codes.
    if not resp.is_success:
        detail = "SharePoint query failed"
        try:
            j = resp.json()
            err = j.get("error") or {}
            msg = err.get("message", "").strip()
            code = err.get("code")
            if code or msg:
                detail = f"{code}: {msg}"
            else:
                detail = str(j)
        except Exception:
            detail = resp.text
        logger.error(f"[/CHECK] SharePoint request failed: {detail}")
        raise HTTPException(status_code=resp.status_code, detail=detail)

    # --- 4. Process the successful response ---
    data = resp.json()
    is_folder = bool(data.get("folder"))
    children = data.get("children") or []

    if not is_folder:
        logger.info(f"[/CHECK] Found an item at {target_path}, but it is not a folder.")
        return CheckResponse(
            ok=True,
            customer=customer,
            order_no=order_no,
            folder_exists=False,
            has_photos=False,
            photo_count=0,
            files=[],
        )

    files: List[FileEntry] = []
    photo_count = 0
    for c in children:
        mime = (c.get("file") or {}).get("mimeType")
        if mime and mime.startswith("image/"):
            photo_count += 1
        files.append(
            FileEntry(
                id=c.get("id"),
                name=c.get("name") or "",
                size=c.get("size") or 0,
                webUrl=c.get("webUrl"),
                content_type=mime,
            )
        )

    logger.info(
        f"[/CHECK] Found folder at {target_path} with {photo_count} immediate photos."
    )
    return CheckResponse(
        ok=True,
        customer=customer,
        order_no=order_no,
        order_folder_id=data.get("id"),
        folder_exists=True,
        has_photos=photo_count > 0,
        photo_count=photo_count,
        files=files,
    )
