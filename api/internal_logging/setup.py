import os, sys
import logging
from pathlib import Path

from .top_prepend import TopPrependFileHandler
from .log_formatter import SanitizedWorkerFormatter

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SERVER_LOGS_DIR = BASE_DIR / "logs/server"
SERVER_LOGS_DIR.mkdir(parents=True, exist_ok=True)


def setup_logging() -> logging.Logger:
    # Configure the ROOT logger - this affects ALL loggers in your app
    root_logger = logging.getLogger()  # No name = root logger
    root_logger.setLevel(logging.INFO)

    # Updated format string with worker info
    # Shows: timestamp [LEVEL] [Worker:PID] logger_name - module.py: message
    fmt = SanitizedWorkerFormatter(
        "%(asctime)s [%(levelname)s] [PID:%(pid)s] %(name)s - %(module)s.py: %(message)s"
    )

    # 1. File handler for all messages (INFO and above)
    file_handler = TopPrependFileHandler(
        SERVER_LOGS_DIR / "qc_app.log",
        mode="line",  # prepend each record
        max_bytes=10 * 1024 * 1024,
        backup_count=5,
    )
    file_handler.setFormatter(fmt)
    file_handler.setLevel(logging.INFO)

    # 2. Console handler for standard output (INFO, WARNING, and ERROR from uvicorn)
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)

    class NonCriticalFilter(logging.Filter):
        """Allow INFO, WARNING, and ERROR but not CRITICAL"""

        def filter(self, record):
            # Special handling for uvicorn.error - send to stdout
            if record.name == "uvicorn.error":
                return record.levelno < logging.CRITICAL
            # For all other loggers, only INFO and WARNING to stdout
            return record.levelno in (logging.INFO, logging.WARNING)

    stdout_handler.addFilter(NonCriticalFilter())
    stdout_handler.setLevel(logging.INFO)

    # 3. Console handler for ONLY critical errors and non-uvicorn errors
    stderr_handler = logging.StreamHandler(sys.stderr)
    stderr_handler.setFormatter(fmt)

    class CriticalAndErrorFilter(logging.Filter):
        """Only allow ERROR and CRITICAL, but exclude uvicorn.error"""

        def filter(self, record):
            # Don't send uvicorn.error to stderr (it goes to stdout)
            if record.name == "uvicorn.error":
                return False
            # Send ERROR and CRITICAL from other loggers to stderr
            return record.levelno >= logging.ERROR

    stderr_handler.addFilter(CriticalAndErrorFilter())
    stderr_handler.setLevel(logging.ERROR)

    # Clear any existing handlers and add new ones to ROOT
    root_logger.handlers.clear()
    root_logger.addHandler(file_handler)
    root_logger.addHandler(stdout_handler)
    root_logger.addHandler(stderr_handler)

    # IMPORTANT: Force uvicorn.error to use our root handlers
    # This prevents uvicorn from creating its own stderr handler
    uvicorn_error = logging.getLogger("uvicorn.error")
    uvicorn_error.handlers = []  # Remove any existing handlers
    uvicorn_error.propagate = True  # Use parent (root) handlers

    # Also ensure uvicorn.access uses root handlers
    uvicorn_access = logging.getLogger("uvicorn.access")
    uvicorn_access.handlers = []
    uvicorn_access.propagate = True


# Optional: Helper function to get current worker info
def get_worker_info():
    """Get current worker information as a dict"""
    return {
        "pid": os.getpid(),
        "worker_id": os.getenv("APP_WORKER_ID", "main"),
        "parent_pid": os.getppid(),
    }


# Optional: Add worker info to your request context
# You can use this in your FastAPI routes
def log_with_worker_context(logger, message, level=logging.INFO):
    """Helper to explicitly log with worker context"""
    worker_info = get_worker_info()
    enhanced_message = f"[Worker {worker_info['worker_id']}] {message}"
    logger.log(level, enhanced_message)
