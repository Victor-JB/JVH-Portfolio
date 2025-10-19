import os
from fastapi import APIRouter
from .routes.get_sales_order import router as SORouter

_missing = [
    k
    for k, v in {
        "GENIUS_HOST": os.getenv("GENIUS_HOST", ""),
        "GENIUS_COMPANY_CODE": os.getenv("GENIUS_COMPANY_CODE", ""),
        "GENIUS_USERNAME": os.getenv("GENIUS_USERNAME", ""),
        "GENIUS_PASSWORD": os.getenv("GENIUS_PASSWORD", "").strip(),
    }.items()
    if not v
]
if _missing:
    raise RuntimeError(f"Missing required env vars: {', '.join(_missing)}")


router = APIRouter(prefix="/api/genius", tags=["genius"])
router.include_router(SORouter)

__all__ = ["router"]
