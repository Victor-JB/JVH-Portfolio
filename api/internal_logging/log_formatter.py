import os
import logging

GENIUS_HOST = os.getenv("GENIUS_HOST")
TENANT_ID = os.getenv("ENTRA_TENANT_ID")
GRAPH_DRIVE_ID = os.getenv("GRAPH_DRIVE_ID")


class SanitizedWorkerFormatter(logging.Formatter):
    """Custom formatter with just PID (simpler, always works)."""

    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        # Just add PID - this is sufficient to identify different workers
        record.pid = os.getpid()

        # Format the message
        formatted_msg = super().format(record)

        # Sanitize sensitive information
        sanitized_msg = formatted_msg.replace(GENIUS_HOST, "[GENIUS_API]")
        sanitized_msg = sanitized_msg.replace(TENANT_ID, "[TENANT_ID]")
        sanitized_msg = sanitized_msg.replace(GRAPH_DRIVE_ID, "[GRAPH_DRIVE_ID]")

        return sanitized_msg
