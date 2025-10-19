import os
from typing import Dict
from .config import SESSION_LOGS_DIR
from .setup import qc_session_logger


def health_snapshot() -> Dict[str, str]:
    # Determine log file path from handler if present

    log_file = SESSION_LOGS_DIR / "qc_sessions.log"
    status = {
        "logger": "ok" if qc_session_logger else "missing",
        "handler": "ok" if qc_session_logger.handlers[0] else "missing",
        "writable": "ok" if log_file.is_file() else ".log file doesn't exist",
        "path": str(log_file) if log_file else "",
    }

    return status
