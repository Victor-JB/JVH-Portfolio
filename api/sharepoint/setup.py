import os
import logging

from ..internal_logging.top_prepend import TopPrependFileHandler
from .config import SP_UPLOAD_SESSION_DIR

ROOT_LOGGER_NAME = os.getenv("APP_LOGGER")

SP_LOG_FILE = SP_UPLOAD_SESSION_DIR / "sp_uploads.log"
SP_LOGGER_NAME = f"{ROOT_LOGGER_NAME}.sp_sessions"

logger = logging.getLogger(ROOT_LOGGER_NAME)


def setup_sp_session_logger() -> logging.Logger:
    lg = logging.getLogger(SP_LOGGER_NAME)
    lg.setLevel(logging.INFO)
    if lg.handlers:
        logger.warning("Duplicate handler creation for sp_sessions")
        return lg

    handler = TopPrependFileHandler(
        SP_LOG_FILE,
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
sp_session_logger = setup_sp_session_logger()
