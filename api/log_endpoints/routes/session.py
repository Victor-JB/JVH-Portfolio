import os
import logging
from fastapi import APIRouter, HTTPException

from ..schemas import SessionLogs
from ..setup import qc_session_logger

router = APIRouter()
server_logger = logging.getLogger(os.getenv("APP_LOGGER"))


@router.post("/session")
async def save_session_logs(session_data: SessionLogs):
    """Log QC session with newest sessions appearing at top of file."""
    try:
        device_str = f"{session_data.device.type}:{session_data.device.model}"

        qc_session_logger.info(f"=== QC SESSION: {session_data.orderId} ===")
        qc_session_logger.info(f"Session ID: {session_data.sessionId}")
        qc_session_logger.info(
            f"Device: {session_data.device.type} ({session_data.device.model})"
        )
        qc_session_logger.info(f"App Version: {session_data.appVersion}")
        # client logs
        for line in session_data.logs:
            qc_session_logger.info(line)
        # end marker (flush to top)
        qc_session_logger.info("")

        server_logger.info(
            "QC Session logged - Order: %s, Device: %s, Entries: %d",
            session_data.orderId,
            device_str,
            len(session_data.logs),
        )

        return {
            "success": True,
            "message": "Session logged successfully",
            "logCount": len(session_data.logs),
        }
    except Exception as e:
        server_logger.exception("Failed to log session: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to log session: {str(e)}")
