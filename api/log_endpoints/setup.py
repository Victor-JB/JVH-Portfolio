import os
import logging
from ..internal_logging.top_prepend import TopPrependFileHandler
from .config import SESSION_LOGS_DIR

QC_LOG_FILE = SESSION_LOGS_DIR / "qc_sessions.log"
QC_LOGGER_NAME = "qc_sessions"

logger = logging.getLogger(os.getenv("APP_LOGGER"))


def setup_qc_session_logger() -> logging.Logger:
    lg = logging.getLogger(QC_LOGGER_NAME)
    lg.setLevel(logging.INFO)
    if lg.handlers:
        logger.warning("Duplicate handler creation for qc_sessions")
        return lg

    handler = TopPrependFileHandler(
        QC_LOG_FILE,
        mode="session",  # buffer + prepend whole session
        max_bytes=10 * 1024 * 1024,
        backup_count=5,
        buffer_min_lines=5,  # only flush if at least 5 lines collected
    )

    handler.setFormatter(logging.Formatter("%(message)s"))
    lg.addHandler(handler)
    lg.propagate = False  # set True to also send to root
    return lg


# Create on import
qc_session_logger = setup_qc_session_logger()
