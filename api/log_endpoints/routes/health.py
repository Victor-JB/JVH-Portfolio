from fastapi import APIRouter, Response
from ..health import health_snapshot

router = APIRouter()


@router.get("/health")
async def health():
    snap = health_snapshot()
    ok = (
        snap.get("logger") == "ok"
        and snap.get("handler") == "ok"
        and snap.get("writable") == "ok"
    )
    status = 200 if ok else 503
    return Response(
        content=str(snap), media_type="application/json", status_code=status
    )
