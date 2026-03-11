from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from client import ControlPlaneClient, is_retryable_control_plane_error
from config import SupervisorConfig, load_supervisor_config
from status_files import read_status_file, status_path_for_worker


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None

    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def log(message: str) -> None:
    print(f"[mt5-supervisor] {message}")


@dataclass
class ManagedWorker:
    slot: int
    worker_id: str
    process: subprocess.Popen[Any] | None = None
    started_at: datetime | None = None
    restart_count: int = 0
    last_exit_code: int | None = None
    last_exit_at: datetime | None = None
    next_restart_at: datetime | None = None
    last_start_error: str | None = None


class WorkerSupervisor:
    def __init__(self, config: SupervisorConfig) -> None:
        self.config = config
        self.started_at = utc_now()
        self.stop_event = threading.Event()
        self.lock = threading.RLock()
        self.workers: dict[int, ManagedWorker] = {
            slot: ManagedWorker(
                slot=slot,
                worker_id=f"{config.worker.worker_id}-slot-{slot}",
            )
            for slot in range(1, config.children + 1)
        }

    def start_all(self) -> None:
        for slot in sorted(self.workers):
            self._start_worker(slot)

    def stop_all(self) -> None:
        with self.lock:
            for worker in self.workers.values():
                self._stop_worker_process(worker)

    def request_shutdown(self) -> None:
        self.stop_event.set()

    def request_restart(self, slot: int) -> bool:
        with self.lock:
            worker = self.workers.get(slot)
            if worker is None:
                return False

            self._stop_worker_process(worker)
            worker.next_restart_at = utc_now()
            return True

    def monitor_once(self) -> None:
        with self.lock:
            now = utc_now()

            for worker in self.workers.values():
                process = worker.process
                if process is not None:
                    exit_code = process.poll()
                    if exit_code is not None:
                        worker.last_exit_code = exit_code
                        worker.last_exit_at = now
                        worker.process = None
                        worker.started_at = None
                        worker.next_restart_at = now + timedelta(
                            seconds=self.config.restart_backoff_seconds
                        )
                        log(
                            f"worker {worker.worker_id} exited with code {exit_code}; "
                            f"restart scheduled at {worker.next_restart_at.isoformat()}"
                        )

                if (
                    worker.process is None
                    and not self.stop_event.is_set()
                    and (worker.next_restart_at is None or now >= worker.next_restart_at)
                ):
                    self._start_worker(worker.slot)

    def health_snapshot(self) -> dict[str, Any]:
        workers = self.workers_snapshot()
        running_count = sum(1 for worker in workers if worker["alive"])
        healthy_count = sum(1 for worker in workers if worker["healthy"])
        healthy = running_count == self.config.children and healthy_count == self.config.children

        return {
            "workerHostId": self.config.worker.worker_id,
            "ok": healthy,
            "status": "ok" if healthy else "degraded",
            "startedAt": self.started_at.isoformat(),
            "updatedAt": utc_now().isoformat(),
            "uptimeSeconds": int((utc_now() - self.started_at).total_seconds()),
            "desiredChildren": self.config.children,
            "runningChildren": running_count,
            "healthyChildren": healthy_count,
            "mode": self.config.worker.mode,
            "host": {
                "id": self.config.worker.worker_id,
                "label": self.config.worker.worker_label,
                "machineName": self.config.worker.machine_name,
                "environment": self.config.worker.host_environment,
                "provider": self.config.worker.host_provider,
                "region": self.config.worker.host_region,
                "tags": self.config.worker.host_tags,
                "os": self.config.worker.os_version,
                "pythonVersion": self.config.worker.python_version,
                "sessionsRoot": self.config.worker.sessions_root,
                "statusRoot": self.config.worker.status_root,
                "terminalPath": self.config.worker.terminal_path,
                "terminalPathMapPatterns": sorted(
                    self.config.worker.terminal_path_map.keys()
                ),
            },
            "admin": {
                "host": self.config.admin_host,
                "port": self.config.admin_port,
            },
            "workers": workers,
        }

    def workers_snapshot(self) -> list[dict[str, Any]]:
        with self.lock:
            return [
                self._snapshot_worker(worker)
                for worker in sorted(self.workers.values(), key=lambda item: item.slot)
            ]

    def sessions_snapshot(self) -> list[dict[str, Any]]:
        sessions: list[dict[str, Any]] = []

        for worker in self.workers_snapshot():
            for session in worker.get("activeConnections", []):
                sessions.append(
                    {
                        **session,
                        "workerId": worker["workerId"],
                        "slot": worker["slot"],
                        "alive": worker["alive"],
                    }
                )

        return sessions

    def _build_child_env(self, worker: ManagedWorker) -> dict[str, str]:
        env = os.environ.copy()
        env["MT5_WORKER_ID"] = worker.worker_id
        env["MT5_CLAIM_LIMIT"] = "1"
        env["MT5_STATUS_ROOT"] = self.config.worker.status_root
        env["PYTHONUNBUFFERED"] = "1"
        return env

    def _start_worker(self, slot: int) -> None:
        worker = self.workers[slot]

        try:
            process = subprocess.Popen(
                [self.config.child_python, self.config.child_script],
                cwd=os.getcwd(),
                env=self._build_child_env(worker),
            )
        except Exception as error:  # noqa: BLE001
            worker.last_start_error = str(error)
            worker.last_exit_at = utc_now()
            worker.next_restart_at = utc_now() + timedelta(
                seconds=self.config.restart_backoff_seconds
            )
            log(f"failed to start worker {worker.worker_id}: {error}")
            return

        worker.process = process
        worker.started_at = utc_now()
        worker.next_restart_at = None
        worker.last_start_error = None
        if worker.last_exit_at is not None or worker.restart_count > 0:
            worker.restart_count += 1
        log(f"started worker {worker.worker_id} with pid {process.pid}")

    def _stop_worker_process(self, worker: ManagedWorker) -> None:
        process = worker.process
        if process is None:
            return

        try:
            process.terminate()
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        finally:
            worker.last_exit_code = process.returncode
            worker.last_exit_at = utc_now()
            worker.process = None
            worker.started_at = None

    def _snapshot_worker(self, worker: ManagedWorker) -> dict[str, Any]:
        status_path = status_path_for_worker(self.config.worker.status_root, worker.worker_id)
        status = read_status_file(status_path)

        process = worker.process
        alive = process is not None and process.poll() is None
        status_updated_at = parse_timestamp(status.get("updatedAt") if status else None)
        stale_after_seconds = max(
            self.config.worker.heartbeat_seconds * 2,
            self.config.worker.poll_seconds * 3,
            30,
        )
        is_fresh = False
        if status_updated_at is not None:
            is_fresh = (utc_now() - status_updated_at).total_seconds() <= stale_after_seconds

        healthy = alive and (status is None or is_fresh)

        return {
            "slot": worker.slot,
            "workerId": worker.worker_id,
            "pid": process.pid if process is not None and alive else None,
            "alive": alive,
            "healthy": healthy,
            "startedAt": worker.started_at.isoformat() if worker.started_at else None,
            "restartCount": worker.restart_count,
            "lastExitCode": worker.last_exit_code,
            "lastExitAt": worker.last_exit_at.isoformat() if worker.last_exit_at else None,
            "lastStartError": worker.last_start_error,
            "nextRestartAt": worker.next_restart_at.isoformat() if worker.next_restart_at else None,
            "statusPath": str(status_path),
            "statusFresh": is_fresh,
            "status": status,
            "activeConnections": status.get("activeConnections", []) if status else [],
        }


class SupervisorHttpServer(ThreadingHTTPServer):
    def __init__(
        self,
        server_address: tuple[str, int],
        request_handler_class: type[BaseHTTPRequestHandler],
        supervisor: WorkerSupervisor,
    ) -> None:
        super().__init__(server_address, request_handler_class)
        self.supervisor = supervisor


class SupervisorRequestHandler(BaseHTTPRequestHandler):
    server: SupervisorHttpServer

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)

        if parsed.path in ("/", "/health"):
            self._send_json(200, self.server.supervisor.health_snapshot())
            return

        if parsed.path == "/workers":
            self._send_json(
                200,
                {
                    "workers": self.server.supervisor.workers_snapshot(),
                },
            )
            return

        if parsed.path == "/sessions":
            self._send_json(
                200,
                {
                    "sessions": self.server.supervisor.sessions_snapshot(),
                },
            )
            return

        self._send_json(404, {"error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        parts = [part for part in parsed.path.split("/") if part]

        if len(parts) == 3 and parts[0] == "workers" and parts[2] == "restart":
            try:
                slot = int(parts[1])
            except ValueError:
                self._send_json(400, {"error": "Invalid worker slot"})
                return

            restarted = self.server.supervisor.request_restart(slot)
            if not restarted:
                self._send_json(404, {"error": "Worker slot not found"})
                return

            self._send_json(
                200,
                {
                    "success": True,
                    "slot": slot,
                    "restarting": True,
                },
            )
            return

        self._send_json(404, {"error": "Not found"})

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, indent=2, sort_keys=True).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def run_admin_server(supervisor: WorkerSupervisor, config: SupervisorConfig) -> SupervisorHttpServer:
    server = SupervisorHttpServer(
        (config.admin_host, config.admin_port),
        SupervisorRequestHandler,
        supervisor,
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def report_supervisor_status(
    client: ControlPlaneClient,
    supervisor: WorkerSupervisor,
    config: SupervisorConfig,
) -> None:
    snapshot = supervisor.health_snapshot()
    client.report_host_status(config.worker.worker_id, snapshot)


def main() -> int:
    parser = argparse.ArgumentParser(description="Profitabledge MT5 worker supervisor")
    parser.add_argument(
        "--children",
        type=int,
        help="Override MT5_SUPERVISOR_CHILDREN for this run",
    )
    args = parser.parse_args()

    config = load_supervisor_config()
    if args.children is not None and args.children > 0:
        config.children = args.children

    supervisor = WorkerSupervisor(config)
    client = ControlPlaneClient(
        config.worker.server_url,
        config.worker.worker_secret,
        timeout_seconds=config.worker.http_timeout_seconds,
        retry_count=config.worker.http_retry_count,
        retry_backoff_seconds=config.worker.http_retry_backoff_seconds,
    )
    last_report_monotonic = 0.0

    def handle_signal(_signum: int, _frame: Any) -> None:
        log("shutdown requested")
        supervisor.request_shutdown()

    signal.signal(signal.SIGINT, handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_signal)

    admin_server = run_admin_server(supervisor, config)
    supervisor.start_all()
    log(
        f"admin API listening on http://{config.admin_host}:{config.admin_port} "
        f"with {config.children} child worker(s)"
    )

    try:
        while not supervisor.stop_event.is_set():
            supervisor.monitor_once()
            now = time.monotonic()
            if now - last_report_monotonic >= config.report_seconds:
                try:
                    report_supervisor_status(client, supervisor, config)
                except Exception as error:  # noqa: BLE001
                    if is_retryable_control_plane_error(error):
                        log(f"host status report skipped: {error}")
                    else:
                        log(f"failed to report host status: {error}")
                else:
                    last_report_monotonic = now
            time.sleep(config.poll_seconds)
    finally:
        admin_server.shutdown()
        admin_server.server_close()
        supervisor.stop_all()
        log("supervisor stopped")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
