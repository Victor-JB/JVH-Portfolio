import os
from fastapi import APIRouter
from .routes.check import router as check_router
from .routes.upload import router as upload_router

_missing = [
    k
    for k, v in {
        "ENTRA_TENANT_ID": os.getenv("ENTRA_TENANT_ID", ""),
        "ENTRA_CLIENT_ID": os.getenv("ENTRA_CLIENT_ID", ""),
        "ENTRA_CLIENT_SECRET": os.getenv("ENTRA_CLIENT_SECRET", ""),
        "DRIVE_ID": os.getenv("GRAPH_DRIVE_ID", "").strip(),
        "ROOT_PATH": os.getenv("GRAPH_ROOT_PATH", "").strip("/"),
    }.items()
    if not v
]
if _missing:
    raise RuntimeError(f"Missing required env vars: {', '.join(_missing)}")


router = APIRouter(prefix="/api/sharepoint", tags=["sharepoint"])
router.include_router(check_router)
router.include_router(upload_router)

__all__ = ["router"]
