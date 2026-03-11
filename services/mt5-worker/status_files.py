from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def sanitize_worker_id(worker_id: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", worker_id)


def status_path_for_worker(status_root: str, worker_id: str) -> Path:
    return Path(status_root).expanduser().resolve() / f"{sanitize_worker_id(worker_id)}.json"


def write_status_file(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(payload, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    temporary_path.replace(path)


def read_status_file(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


class WorkerStatusWriter:
    def __init__(self, status_root: str, worker_id: str) -> None:
        self.worker_id = worker_id
        self.path = status_path_for_worker(status_root, worker_id)

    def write(self, payload: dict[str, Any]) -> None:
        write_status_file(self.path, payload)
