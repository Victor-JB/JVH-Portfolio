from fastapi import APIRouter
from .routes.session import router as session_router
from .routes.health import router as health_router

router = APIRouter(prefix="/api/qc-logs", tags=["qc-logging"])
router.include_router(session_router)
router.include_router(health_router)

__all__ = ["router"]
