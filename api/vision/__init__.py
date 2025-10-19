from fastapi import APIRouter
from .vision_routes import router as vision_router

router = APIRouter(prefix="/api/vision", tags=["vision"])
router.include_router(vision_router)

__all__ = ["router"]
