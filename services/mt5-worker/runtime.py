from __future__ import annotations

import json
import math
import os
import platform
import re
import shutil
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WORKER_SCHEMA_VERSION = "2026-03-10.5"
WORKER_CAPABILITIES = [
    "full-raw-payloads",
    "incremental-history",
    "history-overlap-window",
    "periodic-full-reconcile",
    "session-portable-terminals",
    "broker-quote-snapshots",
    "post-exit-price-tracking",
    "server-side-advanced-metrics-ready",
]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_api_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def iso_now() -> str:
    return to_api_timestamp(utc_now())


def serialize_for_json(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, str)):
        return value

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    if isinstance(value, datetime):
        return to_api_timestamp(value)

    if isinstance(value, Path):
        return str(value)

    if isinstance(value, dict):
        return {
            str(key): serialize_for_json(inner_value)
            for key, inner_value in value.items()
        }

    if hasattr(value, "_asdict"):
        try:
            return serialize_for_json(value._asdict())
        except Exception:  # noqa: BLE001
            pass

    if isinstance(value, (list, tuple, set)):
        return [serialize_for_json(item) for item in value]

    return str(value)


def snapshot_mt5_record(record: Any) -> dict[str, Any]:
    payload = serialize_for_json(record)
    if isinstance(payload, dict):
        return payload
    return {"value": payload}


def build_worker_runtime_meta(*, mode: str) -> dict[str, Any]:
    return {
        "workerSchemaVersion": WORKER_SCHEMA_VERSION,
        "capabilities": WORKER_CAPABILITIES,
        "mode": mode,
        "pythonVersion": platform.python_version(),
        "platform": platform.platform(),
        "implementation": sys.implementation.name,
    }


def resolve_terminal_executable(raw_path: str) -> Path:
    path = Path(raw_path).expanduser()

    if path.is_file():
        return path.resolve()

    if path.is_dir():
        for candidate in ("terminal64.exe", "terminal.exe"):
            executable = path / candidate
            if executable.is_file():
                return executable.resolve()

    raise RuntimeError(
        f"MT5 terminal executable not found at {raw_path}. "
        "Set MT5_TERMINAL_PATH to terminal64.exe, terminal.exe, or an installation directory."
    )


def _normalize_match_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


BROKER_SERVER_TOKEN_HINTS: dict[str, list[str]] = {
    "ftmo": ["ftmo"],
    "fundednext": ["fundednext"],
    "funded next": ["fundednext"],
    "icmarkets": ["icmarkets", "ic markets"],
    "ic markets": ["icmarkets", "ic markets"],
    "oanda": ["oanda"],
    "topstep": ["topstep"],
    "apex": ["apex"],
    "tradelocker": ["tradelocker", "trade locker"],
    "match trader": ["matchtrader", "match trader"],
    "matchtrader": ["matchtrader", "match trader"],
}


def build_server_match_tokens(server_name: str) -> list[str]:
    normalized = _normalize_match_text(server_name)
    tokens = [token for token in normalized.split(" ") if token]
    expanded = set(tokens)

    for key, aliases in BROKER_SERVER_TOKEN_HINTS.items():
        if key in normalized:
            expanded.update(aliases)

    return sorted(expanded)


def score_terminal_template_for_server(
    *,
    server_name: str,
    executable: Path,
) -> int:
    normalized_server = _normalize_match_text(server_name)
    normalized_path = _normalize_match_text(str(executable.parent))
    tokens = build_server_match_tokens(server_name)
    score = 0

    for token in tokens:
        if token and token in normalized_path:
            score += max(len(token), 4)

    if normalized_server and normalized_server in normalized_path:
        score += 50

    return score


def discover_installed_terminal_executables() -> list[Path]:
    candidates: set[Path] = set()
    roots = [
        os.getenv("ProgramFiles"),
        os.getenv("ProgramFiles(x86)"),
        os.getenv("LocalAppData"),
    ]

    for raw_root in roots:
        if not raw_root:
            continue

        root = Path(raw_root)
        if not root.exists():
            continue

        for pattern in (
            "*MetaTrader*/*terminal64.exe",
            "*MetaTrader*/*terminal.exe",
            "*/*MetaTrader*/*terminal64.exe",
            "*/*MetaTrader*/*terminal.exe",
            "*FTMO*/*terminal64.exe",
            "*FTMO*/*terminal.exe",
            "*/*FTMO*/*terminal64.exe",
            "*/*FTMO*/*terminal.exe",
        ):
            for match in root.glob(pattern):
                if match.is_file():
                    candidates.add(match.resolve())

    return sorted(candidates)


@dataclass
class TerminalSession:
    connection_id: str
    login: str
    server_name: str
    template_executable_path: Path
    session_root: Path
    installation_root: Path
    executable_path: Path
    metadata_path: Path
    template_resolution: str = "default"
    initialized_at: datetime | None = None
    last_login_at: datetime | None = None
    last_collect_at: datetime | None = None
    last_heartbeat_at: datetime | None = None
    collect_count: int = 0
    consecutive_failures: int = 0


class TerminalSessionManager:
    def __init__(
        self,
        template_path: str,
        sessions_root: str,
        *,
        template_path_map: dict[str, str] | None = None,
    ) -> None:
        self.default_template_executable = resolve_terminal_executable(template_path)
        self.default_template_root = self.default_template_executable.parent.resolve()
        self.template_path_rules = [
            (pattern, resolve_terminal_executable(path))
            for pattern, path in (template_path_map or {}).items()
        ]
        self.discovered_template_executables = discover_installed_terminal_executables()
        self.sessions_root = Path(sessions_root).expanduser().resolve()
        self.sessions: dict[str, TerminalSession] = {}

    def resolve_template_executable_for_server(self, server_name: str) -> tuple[Path, str]:
        for pattern, executable in self.template_path_rules:
            try:
                if re.search(pattern, server_name, re.IGNORECASE):
                    return executable, "explicit-map"
            except re.error as error:
                raise RuntimeError(
                    f"Invalid MT5_TERMINAL_PATH_MAP regex '{pattern}': {error}"
                ) from error

        best_executable: Path | None = None
        best_score = 0

        for executable in self.discovered_template_executables:
            score = score_terminal_template_for_server(
                server_name=server_name,
                executable=executable,
            )
            if score > best_score:
                best_score = score
                best_executable = executable

        if best_executable is not None and best_score > 0:
            return best_executable, "auto-discovered"

        return self.default_template_executable, "default"

    def prepare_session(self, bootstrap: dict[str, Any]) -> TerminalSession:
        connection_id = str(bootstrap["connectionId"])
        credentials = bootstrap["credentials"]
        login = str(credentials["login"]).strip()
        server_name = str(credentials["server"]).strip()
        template_executable, template_resolution = self.resolve_template_executable_for_server(
            server_name
        )
        template_root = template_executable.parent.resolve()

        existing = self.sessions.get(connection_id)
        if existing is None:
            session_root = self.sessions_root / connection_id
            installation_root = session_root / "terminal"
            executable_path = installation_root / template_executable.name
            metadata_path = session_root / "session.json"
            existing = TerminalSession(
                connection_id=connection_id,
                login=login,
                server_name=server_name,
                template_executable_path=template_executable,
                session_root=session_root,
                installation_root=installation_root,
                executable_path=executable_path,
                metadata_path=metadata_path,
                template_resolution=template_resolution,
            )
            self.sessions[connection_id] = existing
        else:
            template_changed = (
                existing.template_executable_path.resolve() != template_executable.resolve()
            )
            existing.login = login
            existing.server_name = server_name
            existing.template_resolution = template_resolution
            if template_changed:
                existing.template_executable_path = template_executable
                existing.executable_path = existing.installation_root / template_executable.name
                if existing.installation_root.exists():
                    shutil.rmtree(existing.installation_root, ignore_errors=True)

        existing.session_root.mkdir(parents=True, exist_ok=True)
        self._ensure_installation(existing, template_root=template_root)
        self._write_metadata(existing)
        return existing

    def get_session(self, connection_id: str) -> TerminalSession | None:
        return self.sessions.get(connection_id)

    def rebuild_installation(self, session: TerminalSession) -> None:
        if session.installation_root.exists():
            shutil.rmtree(session.installation_root, ignore_errors=True)
        self._ensure_installation(
            session,
            template_root=session.template_executable_path.parent.resolve(),
        )

    def mark_login(self, session: TerminalSession) -> None:
        now = utc_now()
        if session.initialized_at is None:
            session.initialized_at = now
        session.last_login_at = now
        session.consecutive_failures = 0
        self._write_metadata(session)

    def mark_collect(self, session: TerminalSession) -> None:
        session.last_collect_at = utc_now()
        session.collect_count += 1
        session.consecutive_failures = 0
        self._write_metadata(session)

    def mark_heartbeat(self, session: TerminalSession) -> None:
        session.last_heartbeat_at = utc_now()
        self._write_metadata(session)

    def mark_failure(self, session: TerminalSession, message: str) -> None:
        session.consecutive_failures += 1
        self._write_metadata(session, extra={"lastError": message})

    def build_session_meta(
        self, session: TerminalSession, *, lookback_days: int | None = None
    ) -> dict[str, Any]:
        meta: dict[str, Any] = {
            "adapter": "terminal",
            "sessionRoot": str(session.session_root),
            "installationRoot": str(session.installation_root),
            "terminalPath": str(session.executable_path),
            "portable": True,
            "login": session.login,
            "serverName": session.server_name,
            "templateResolution": session.template_resolution,
            "collectCount": session.collect_count,
            "consecutiveFailures": session.consecutive_failures,
            "templatePath": str(session.template_executable_path),
        }

        if lookback_days is not None:
            meta["lookbackDays"] = lookback_days
        if session.initialized_at is not None:
            meta["initializedAt"] = to_api_timestamp(session.initialized_at)
        if session.last_login_at is not None:
            meta["lastLoginAt"] = to_api_timestamp(session.last_login_at)
        if session.last_collect_at is not None:
            meta["lastCollectAt"] = to_api_timestamp(session.last_collect_at)
        if session.last_heartbeat_at is not None:
            meta["lastHeartbeatAt"] = to_api_timestamp(session.last_heartbeat_at)

        return meta

    def _ensure_installation(self, session: TerminalSession, *, template_root: Path) -> None:
        if session.executable_path.is_file():
            return

        session.installation_root.parent.mkdir(parents=True, exist_ok=True)
        last_error: Exception | None = None
        for attempt in range(5):
            try:
                shutil.copytree(
                    template_root,
                    session.installation_root,
                    dirs_exist_ok=True,
                )
                return
            except Exception as error:  # noqa: BLE001
                last_error = error
                if session.installation_root.exists():
                    shutil.rmtree(session.installation_root, ignore_errors=True)
                if attempt == 4:
                    raise
                time.sleep(1 + attempt)

        if last_error is not None:
            raise last_error

    def _write_metadata(
        self, session: TerminalSession, extra: dict[str, Any] | None = None
    ) -> None:
        payload: dict[str, Any] = {
            "connectionId": session.connection_id,
            "login": session.login,
            "serverName": session.server_name,
            "sessionRoot": str(session.session_root),
            "installationRoot": str(session.installation_root),
            "terminalPath": str(session.executable_path),
            "templatePath": str(session.template_executable_path),
            "templateResolution": session.template_resolution,
            "portable": True,
            "initializedAt": to_api_timestamp(session.initialized_at)
            if session.initialized_at
            else None,
            "lastLoginAt": to_api_timestamp(session.last_login_at)
            if session.last_login_at
            else None,
            "lastCollectAt": to_api_timestamp(session.last_collect_at)
            if session.last_collect_at
            else None,
            "lastHeartbeatAt": to_api_timestamp(session.last_heartbeat_at)
            if session.last_heartbeat_at
            else None,
            "collectCount": session.collect_count,
            "consecutiveFailures": session.consecutive_failures,
            "updatedAt": iso_now(),
        }

        if extra:
            payload.update(extra)

        session.metadata_path.write_text(
            json.dumps(payload, indent=2, sort_keys=True),
            encoding="utf-8",
        )
