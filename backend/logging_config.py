"""Mirror real console output (stdout/stderr) into daily log files."""

import atexit
import logging
import os
import re
import sys
import threading
from datetime import datetime, timedelta

from config import LOG_DIR, LOG_FILE_BASENAME, LOG_RETENTION_DAYS


ANSI_ESCAPE_RE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


class _DailyLogFile:
    """Handle daily file creation and retention cleanup."""

    def __init__(self, log_dir: str, base_filename: str, retention_days: int):
        self.log_dir = log_dir
        self.retention_days = retention_days

        root, ext = os.path.splitext(base_filename)
        self.file_prefix = root
        self.file_ext = ext or ".log"

        self._current_date = ""
        self._stream = None
        self._lock = threading.RLock()
        self._at_line_start = True

    def _build_path(self, date_str: str) -> str:
        return os.path.join(self.log_dir, f"{self.file_prefix}-{date_str}{self.file_ext}")

    def _cleanup_old_files(self):
        cutoff = datetime.now() - timedelta(days=self.retention_days)
        for filename in os.listdir(self.log_dir):
            if not filename.startswith(f"{self.file_prefix}-") or not filename.endswith(self.file_ext):
                continue

            date_part = filename[len(self.file_prefix) + 1 : -len(self.file_ext)]
            try:
                file_date = datetime.strptime(date_part, "%Y-%m-%d")
            except ValueError:
                continue

            if file_date < cutoff:
                try:
                    os.remove(os.path.join(self.log_dir, filename))
                except OSError:
                    pass

    def write(self, data: str):
        with self._lock:
            today = datetime.now().strftime("%Y-%m-%d")

            if today != self._current_date or self._stream is None:
                if self._stream is not None:
                    self._stream.close()
                self._current_date = today
                self._stream = open(self._build_path(today), "a", encoding="utf-8")
                self._cleanup_old_files()

            clean_data = ANSI_ESCAPE_RE.sub("", data)
            self._stream.write(self._with_timestamp(clean_data))
            self._stream.flush()

    def _with_timestamp(self, data: str) -> str:
        """Prefix each written log line with local datetime."""
        if not data:
            return data

        parts = data.splitlines(keepends=True)
        output = []

        for part in parts:
            if self._at_line_start and part:
                ts = datetime.now().strftime("%H:%M:%S")
                output.append(f"{ts} | ")

            output.append(part)
            self._at_line_start = part.endswith("\n")

        return "".join(output)

    def flush(self):
        with self._lock:
            if self._stream is not None:
                self._stream.flush()

    def close(self):
        with self._lock:
            if self._stream is not None:
                self._stream.close()
                self._stream = None


class _TeeStream:
    """Write output to original console stream and to daily file."""

    def __init__(self, original_stream, daily_log_file: _DailyLogFile):
        self._original_stream = original_stream
        self._daily_log_file = daily_log_file

    def write(self, data):
        self._original_stream.write(data)
        self._original_stream.flush()
        try:
            self._daily_log_file.write(data)
        except Exception:
            pass

    def flush(self):
        self._original_stream.flush()
        try:
            self._daily_log_file.flush()
        except Exception:
            pass

    def fileno(self):
        return self._original_stream.fileno()

    def isatty(self):
        return self._original_stream.isatty()

    def __getattr__(self, item):
        return getattr(self._original_stream, item)


_installed = False
_daily_log = None


def _rebind_stream_handlers(old_stdout, old_stderr) -> None:
    """Rebind existing StreamHandlers created before tee installation.

    Uvicorn CLI configures logging before importing the app module.
    Those handlers keep references to old stdio streams unless rebound.
    """
    candidates = [logging.getLogger()]
    candidates.extend(
        logger
        for logger in logging.root.manager.loggerDict.values()
        if isinstance(logger, logging.Logger)
    )

    for logger in candidates:
        for handler in logger.handlers:
            if not isinstance(handler, logging.StreamHandler):
                continue

            stream = getattr(handler, "stream", None)
            if stream is old_stdout or stream is sys.__stdout__:
                handler.setStream(sys.stdout)
            elif stream is old_stderr or stream is sys.__stderr__:
                handler.setStream(sys.stderr)


def setup_logging() -> None:
    """Install stdout/stderr mirror once so file equals console output."""
    global _installed
    global _daily_log

    if _installed:
        return

    base_dir = os.path.dirname(os.path.abspath(__file__))
    log_dir = os.path.join(base_dir, LOG_DIR)
    os.makedirs(log_dir, exist_ok=True)

    old_stdout = sys.stdout
    old_stderr = sys.stderr

    _daily_log = _DailyLogFile(log_dir, LOG_FILE_BASENAME, LOG_RETENTION_DAYS)

    if not isinstance(sys.stdout, _TeeStream):
        sys.stdout = _TeeStream(sys.stdout, _daily_log)
    if not isinstance(sys.stderr, _TeeStream):
        sys.stderr = _TeeStream(sys.stderr, _daily_log)

    _rebind_stream_handlers(old_stdout, old_stderr)

    atexit.register(_daily_log.close)
    _installed = True
    print(f"Logging initialisiert. Verzeichnis: {log_dir}")
