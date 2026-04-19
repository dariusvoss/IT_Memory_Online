"""Central logging configuration for the backend application."""

import logging
import os
from datetime import datetime, timedelta

from config import LOG_DIR, LOG_FILE_BASENAME, LOG_RETENTION_DAYS


class DailyFileHandler(logging.Handler):
    """Write logs into a separate file per day and rotate automatically."""

    def __init__(self, log_dir: str, base_filename: str, retention_days: int):
        super().__init__()
        self.log_dir = log_dir
        self.retention_days = retention_days

        root, ext = os.path.splitext(base_filename)
        self.file_prefix = root
        self.file_ext = ext or ".log"

        self.current_date = ""
        self.stream = None

    def _get_file_path(self, date_str: str) -> str:
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
                    # Best effort cleanup should never break logging.
                    pass

    def _ensure_stream(self):
        today = datetime.now().strftime("%Y-%m-%d")
        if today == self.current_date and self.stream is not None:
            return

        if self.stream is not None:
            self.stream.close()

        self.current_date = today
        self.stream = open(self._get_file_path(today), "a", encoding="utf-8")
        self._cleanup_old_files()

    def emit(self, record: logging.LogRecord):
        try:
            self._ensure_stream()
            msg = self.format(record)
            self.stream.write(msg + "\n")
            self.stream.flush()
        except Exception:
            self.handleError(record)

    def close(self):
        if self.stream is not None:
            self.stream.close()
            self.stream = None
        super().close()


def setup_logging() -> logging.Logger:
    """Configure console and daily rotating file logging."""
    base_dir = os.path.dirname(__file__)
    log_dir = os.path.join(base_dir, LOG_DIR)
    os.makedirs(log_dir, exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Avoid duplicate handlers when app reloads in development.
    if root_logger.handlers:
        root_logger.handlers.clear()

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    file_handler = DailyFileHandler(
        log_dir=log_dir,
        base_filename=LOG_FILE_BASENAME,
        retention_days=LOG_RETENTION_DAYS,
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)

    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    app_logger = logging.getLogger("memory-backend")
    app_logger.info("Logging initialized. Directory: %s", log_dir)
    return app_logger
