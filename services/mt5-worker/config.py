import os
import platform
import re
import socket
import sys
import json
from dataclasses import dataclass


WORKER_ROOT = os.path.dirname(__file__)


def parse_terminal_path_map(raw_value: str) -> dict[str, str]:
    raw = raw_value.strip()
    if not raw:
        return {}

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = None

    if parsed is not None:
        if not isinstance(parsed, dict):
            raise RuntimeError("MT5_TERMINAL_PATH_MAP must be a JSON object")
        return {
            str(key): str(value)
            for key, value in parsed.items()
            if str(key).strip() and str(value).strip()
        }

    # PowerShell can strip inner JSON quotes when values are passed via `powershell -File`.
    # Accept a tolerant fallback syntax too:
    #   {^FTMO-:C:\Program Files\FTMO MetaTrader 5\terminal64.exe}
    #   ^FTMO-=C:\Program Files\FTMO MetaTrader 5\terminal64.exe
    normalized = raw
    if normalized.startswith("{") and normalized.endswith("}"):
        normalized = normalized[1:-1].strip()

    if not normalized:
        return {}

    entries: dict[str, str] = {}
    parts = [
        part.strip()
        for part in re.split(r"\s*[;,]\s*", normalized)
        if part.strip()
    ]

    for part in parts:
        match = re.match(r'^"?([^"=:]+)"?\s*(?::|=)\s*"?(.+?)"?$', part)
        if not match:
            raise RuntimeError(
                "MT5_TERMINAL_PATH_MAP must be valid JSON or use the fallback "
                "syntax '^REGEX-=C:\\Path\\terminal64.exe'"
            )

        key = match.group(1).strip()
        value = match.group(2).strip()
        if key and value:
            entries[key] = value

    return entries


@dataclass
class WorkerConfig:
    server_url: str
    worker_secret: str
    worker_id: str
    worker_label: str
    machine_name: str
    host_environment: str
    host_provider: str | None
    host_region: str | None
    host_tags: list[str]
    os_version: str
    python_version: str
    mode: str
    http_timeout_seconds: int
    http_retry_count: int
    http_retry_backoff_seconds: float
    poll_seconds: int
    heartbeat_seconds: int
    claim_limit: int
    lookback_days: int
    sessions_root: str
    status_root: str
    terminal_path: str | None
    terminal_path_map: dict[str, str]
    initialize_timeout_ms: int
    connected_timeout_seconds: int
    history_overlap_seconds: int
    history_future_seconds: int
    tick_replay_seconds: int
    full_reconcile_minutes: int
    post_exit_tracking_seconds: int


@dataclass
class SupervisorConfig:
    worker: WorkerConfig
    children: int
    admin_host: str
    admin_port: int
    report_seconds: int
    restart_backoff_seconds: int
    poll_seconds: int
    child_python: str
    child_script: str


def load_config() -> WorkerConfig:
    worker_secret = os.getenv("BROKER_WORKER_SECRET", "").strip()
    if not worker_secret:
        raise RuntimeError("BROKER_WORKER_SECRET is required")

    machine_name = socket.gethostname()
    worker_id = os.getenv("MT5_WORKER_ID", machine_name).strip() or machine_name
    worker_label = os.getenv("MT5_WORKER_LABEL", worker_id).strip() or worker_id
    host_environment = (
        os.getenv("MT5_WORKER_ENVIRONMENT", "development").strip().lower()
        or "development"
    )
    host_provider = os.getenv("MT5_WORKER_PROVIDER", "").strip() or None
    host_region = os.getenv("MT5_WORKER_REGION", "").strip() or None
    host_tags = [
        value.strip()
        for value in os.getenv("MT5_WORKER_TAGS", "").split(",")
        if value.strip()
    ]
    raw_terminal_path_map = os.getenv("MT5_TERMINAL_PATH_MAP", "").strip()
    terminal_path_map = parse_terminal_path_map(raw_terminal_path_map)

    return WorkerConfig(
        server_url=os.getenv("PE_SERVER_URL", "http://localhost:3000").rstrip("/"),
        worker_secret=worker_secret,
        worker_id=worker_id,
        worker_label=worker_label,
        machine_name=machine_name,
        host_environment=host_environment,
        host_provider=host_provider,
        host_region=host_region,
        host_tags=host_tags,
        os_version=platform.platform(),
        python_version=platform.python_version(),
        mode=os.getenv("MT5_WORKER_MODE", "mock").strip().lower(),
        http_timeout_seconds=max(
            int(os.getenv("MT5_HTTP_TIMEOUT_SECONDS", "30")),
            5,
        ),
        http_retry_count=max(
            int(os.getenv("MT5_HTTP_RETRY_COUNT", "4")),
            0,
        ),
        http_retry_backoff_seconds=max(
            float(os.getenv("MT5_HTTP_RETRY_BACKOFF_SECONDS", "1.5")),
            0.0,
        ),
        poll_seconds=max(int(os.getenv("MT5_POLL_SECONDS", "30")), 1),
        heartbeat_seconds=max(int(os.getenv("MT5_HEARTBEAT_SECONDS", "5")), 1),
        claim_limit=max(int(os.getenv("MT5_CLAIM_LIMIT", "5")), 1),
        lookback_days=max(int(os.getenv("MT5_LOOKBACK_DAYS", "90")), 1),
        sessions_root=os.getenv(
            "MT5_SESSIONS_ROOT",
            os.path.join(WORKER_ROOT, ".mt5-worker", "sessions"),
        ),
        status_root=os.getenv(
            "MT5_STATUS_ROOT",
            os.path.join(WORKER_ROOT, ".mt5-worker", "status"),
        ),
        terminal_path=os.getenv("MT5_TERMINAL_PATH"),
        terminal_path_map=terminal_path_map,
        initialize_timeout_ms=max(
            int(os.getenv("MT5_INITIALIZE_TIMEOUT_MS", "60000")),
            1000,
        ),
        connected_timeout_seconds=max(
            int(os.getenv("MT5_CONNECTED_TIMEOUT_SECONDS", "20")),
            1,
        ),
        history_overlap_seconds=max(
            int(os.getenv("MT5_HISTORY_OVERLAP_SECONDS", "90")),
            0,
        ),
        history_future_seconds=max(
            int(os.getenv("MT5_HISTORY_FUTURE_SECONDS", "28800")),
            0,
        ),
        tick_replay_seconds=max(
            int(os.getenv("MT5_TICK_REPLAY_SECONDS", "10")),
            1,
        ),
        full_reconcile_minutes=max(
            int(os.getenv("MT5_FULL_RECONCILE_MINUTES", "720")),
            1,
        ),
        post_exit_tracking_seconds=max(
            int(os.getenv("MT5_POST_EXIT_TRACKING_SECONDS", "3600")),
            0,
        ),
    )


def load_supervisor_config() -> SupervisorConfig:
    worker = load_config()

    return SupervisorConfig(
        worker=worker,
        children=max(int(os.getenv("MT5_SUPERVISOR_CHILDREN", "2")), 1),
        admin_host=os.getenv("MT5_SUPERVISOR_ADMIN_HOST", "127.0.0.1").strip(),
        admin_port=max(int(os.getenv("MT5_SUPERVISOR_ADMIN_PORT", "9680")), 1),
        report_seconds=max(
            int(os.getenv("MT5_SUPERVISOR_REPORT_SECONDS", "5")),
            1,
        ),
        restart_backoff_seconds=max(
            int(os.getenv("MT5_SUPERVISOR_RESTART_BACKOFF_SECONDS", "5")),
            1,
        ),
        poll_seconds=max(int(os.getenv("MT5_SUPERVISOR_POLL_SECONDS", "2")), 1),
        child_python=os.getenv("MT5_SUPERVISOR_CHILD_PYTHON", sys.executable),
        child_script=os.getenv(
            "MT5_SUPERVISOR_CHILD_SCRIPT",
            os.path.join(os.path.dirname(__file__), "main.py"),
        ),
    )
