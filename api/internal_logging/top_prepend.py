"""
- Single handler class for both root/internal and QC session logs.
- Two modes:
  • mode="line": prepend each record as it arrives (root/internal logs)
  • mode="session": buffer until an end-of-session trigger, then prepend the whole block (QC)
- Thread-safe, size-based rotation, backup pruning.
- Optional custom end-of-session predicate.
"""

from __future__ import annotations
import logging
from pathlib import Path
from datetime import datetime
import threading
from typing import Callable, Optional, Iterable


class TopPrependFileHandler(logging.Handler):
    def __init__(
        self,
        filename: str | Path,
        *,
        mode: str = "line",  # "line" | "session"
        max_bytes: int = 10 * 1024 * 1024,
        backup_count: int = 5,
        session_end_pred: Optional[Callable[[str, logging.LogRecord], bool]] = None,
        buffer_min_lines: int = 1,
    ) -> None:
        super().__init__()
        self.filename = Path(filename)
        self.mode = mode
        self.max_bytes = max_bytes
        self.backup_count = backup_count
        self._lock = threading.Lock()
        self._buf: list[str] = []
        self._session_end_pred = session_end_pred or self._default_session_end
        self._buffer_min_lines = buffer_min_lines

    # --- public helpers (useful for QC routes) ---
    def start_session(self) -> None:
        if self.mode == "session":
            with self._lock:
                self._buf.clear()

    def flush_session(self) -> None:
        if self.mode == "session":
            with self._lock:
                self._prepend_locked(self._buf)
                self._buf.clear()

    # --- logging.Handler API ---
    def emit(self, record: logging.LogRecord) -> None:  # type: ignore[override]
        try:
            line = self.format(record)
            if self.mode == "line":
                with self._lock:
                    self._prepend_locked([line])
                return
            # session mode
            with self._lock:
                self._buf.append(line)
                if (
                    self._session_end_pred(line, record)
                    and len(self._buf) >= self._buffer_min_lines
                ):
                    self._prepend_locked(self._buf)
                    self._buf.clear()
        except Exception:
            # never raise from logging
            logging.getLogger("logging.error").exception(
                "TopPrependFileHandler emit failed"
            )

    def flush(self) -> None:  # type: ignore[override]
        if self.mode == "session":
            with self._lock:
                if self._buf:
                    self._prepend_locked(self._buf)
                    self._buf.clear()

    # --- internals ---
    def _default_session_end(self, line: str, record: logging.LogRecord) -> bool:
        # Treat an empty line as end-of-session (matches your QC behavior)
        return line.strip() == ""

    def _rotate_if_needed_locked(self) -> None:
        if not self.filename.exists():
            return
        try:
            if self.filename.stat().st_size <= self.max_bytes:
                return
            backup = self.filename.with_name(
                f"{self.filename.stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{self.filename.suffix}"
            )
            self.filename.rename(backup)
            backups = sorted(
                self.filename.parent.glob(
                    f"{self.filename.stem}_*{self.filename.suffix}"
                ),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            for old in backups[self.backup_count :]:
                try:
                    old.unlink()
                except Exception:
                    pass
        except Exception:
            pass

    def _prepend_locked(self, lines: Iterable[str]) -> None:
        self.filename.parent.mkdir(parents=True, exist_ok=True)
        existing = ""
        if self.filename.exists():
            try:
                with open(self.filename, "r", encoding="utf-8") as f:
                    existing = f.read()
            except Exception:
                existing = ""
        try:
            with open(self.filename, "w", encoding="utf-8") as f:
                f.write("\n".join(lines) + "\n")
                if existing:
                    f.write(existing)
        finally:
            self._rotate_if_needed_locked()
