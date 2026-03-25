from __future__ import annotations

import argparse
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from client import ControlPlaneClient, is_retryable_control_plane_error
from config import WorkerConfig, load_config
from adapters.mock import MockMtAdapter
from adapters.meta_trader5 import MetaTrader5Adapter
from hosting_policy import build_worker_host_policy_meta, validate_connection_host_policy
from runtime import to_api_timestamp
from status_files import WorkerStatusWriter


@dataclass
class ActiveConnectionState:
    connection_id: str
    session_key: str
    last_meta: dict[str, Any]
    last_synced_at: datetime
    last_heartbeat_at: datetime


class InactiveConnectionError(RuntimeError):
    def __init__(
        self,
        connection_id: str,
        *,
        reason: str,
        meta: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(reason)
        self.connection_id = connection_id
        self.reason = reason
        self.meta = meta or {}


def log_message(worker_id: str, message: str, *, error: bool = False) -> None:
    print(
        f"[mt5-worker {worker_id}] {message}",
        file=sys.stderr if error else sys.stdout,
    )


def best_effort_report_status(
    client: ControlPlaneClient,
    worker_id: str,
    *,
    connection_id: str,
    worker_host_id: str,
    host_id: str | None = None,
    status: str,
    session_key: str | None = None,
    last_error: str | None = None,
    meta: dict[str, Any] | None = None,
) -> bool:
    try:
        client.report_status(
            connection_id=connection_id,
            worker_host_id=worker_host_id,
            host_id=host_id,
            status=status,
            session_key=session_key,
            last_error=last_error,
            meta=meta,
        )
        return True
    except Exception as error:  # noqa: BLE001
        log_message(
            worker_id,
            (
                f"status update skipped for {connection_id}: {error}"
                if is_retryable_control_plane_error(error)
                else f"status update failed for {connection_id}: {error}"
            ),
            error=not is_retryable_control_plane_error(error),
        )
        return False


def best_effort_release_connection(
    adapter: Any,
    worker_id: str,
    connection_id: str,
) -> None:
    try:
        adapter.release_connection(connection_id)
    except Exception as error:  # noqa: BLE001
        log_message(
            worker_id,
            f"failed to release {connection_id}: {error}",
            error=True,
        )


def assert_connection_is_live(
    bootstrap: dict[str, Any],
    connection_id: str,
) -> None:
    if bootstrap.get("isPaused") is True:
        raise InactiveConnectionError(
            connection_id,
            reason="paused",
            meta={
                "phase": "sleeping",
                "sleepReason": "paused",
            },
        )

    live_lease = bootstrap.get("liveLease")
    if not isinstance(live_lease, dict):
        return

    if live_lease.get("active") is False:
        try:
            active_holder_count = int(live_lease.get("activeHolderCount", 0) or 0)
        except (TypeError, ValueError):
            active_holder_count = 0

        raise InactiveConnectionError(
            connection_id,
            reason="lease_inactive",
            meta={
                "phase": "sleeping",
                "sleepReason": "no_live_viewer",
                "activeHolderCount": active_holder_count,
                "leaseUntil": live_lease.get("leaseUntil"),
                "lastHeartbeatAt": live_lease.get("lastHeartbeatAt"),
            },
        )


def build_adapter(config: WorkerConfig):
    mode = config.mode
    if mode == "mock":
        return MockMtAdapter()
    if mode == "terminal":
        return MetaTrader5Adapter(
            terminal_path=config.terminal_path,
            terminal_path_map=config.terminal_path_map,
            sessions_root=config.sessions_root,
            initialize_timeout_ms=config.initialize_timeout_ms,
            connected_timeout_seconds=config.connected_timeout_seconds,
            history_overlap_seconds=config.history_overlap_seconds,
            history_future_seconds=config.history_future_seconds,
            tick_replay_seconds=config.tick_replay_seconds,
            full_reconcile_minutes=config.full_reconcile_minutes,
            post_exit_tracking_seconds=config.post_exit_tracking_seconds,
        )
    raise RuntimeError(f"Unsupported MT5 worker mode: {mode}")


def build_claim_host_payload(config: WorkerConfig) -> dict[str, Any]:
    worker_host_meta = build_worker_host_policy_meta(config)
    payload: dict[str, Any] = {
        "label": config.worker_label,
        "environment": config.host_environment,
        "provider": config.host_provider,
        "region": config.host_region,
        "regionGroup": worker_host_meta.get("hostRegionGroup"),
        "countryCode": config.host_country_code,
        "city": config.host_city,
        "timezone": config.host_timezone,
        "publicIp": config.host_public_ip,
        "tags": config.host_tags,
        "deviceIsolationMode": config.device_isolation_mode,
        "reservedUserId": config.reserved_user_id,
    }

    return {key: value for key, value in payload.items() if value is not None}


def serialize_active_connections(
    active_connections: dict[str, ActiveConnectionState],
) -> list[dict[str, Any]]:
    return [
        {
            "connectionId": state.connection_id,
            "sessionKey": state.session_key,
            "lastSyncedAt": state.last_synced_at.isoformat(),
            "lastHeartbeatAt": state.last_heartbeat_at.isoformat(),
            "sessionMeta": state.last_meta,
        }
        for state in active_connections.values()
    ]


def write_worker_status(
    status_writer: WorkerStatusWriter,
    config: WorkerConfig,
    *,
    started_at: datetime,
    active_connections: dict[str, ActiveConnectionState],
    state: str,
    phase: str,
    last_error: str | None = None,
    pinned_connection_id: str | None = None,
) -> None:
    worker_host_meta = build_worker_host_policy_meta(config)
    status_writer.write(
        {
            "workerId": config.worker_id,
            "hostId": config.host_id,
            "pid": os.getpid(),
            "mode": config.mode,
            "state": state,
            "phase": phase,
            "pollSeconds": config.poll_seconds,
            "heartbeatSeconds": config.heartbeat_seconds,
            "claimLimit": config.claim_limit,
            "lookbackDays": config.lookback_days,
            "historyOverlapSeconds": config.history_overlap_seconds,
            "historyFutureSeconds": config.history_future_seconds,
            "tickReplaySeconds": config.tick_replay_seconds,
            "fullReconcileMinutes": config.full_reconcile_minutes,
            "postExitTrackingSeconds": config.post_exit_tracking_seconds,
            "hostCountryCode": config.host_country_code,
            "hostRegionGroup": worker_host_meta.get("hostRegionGroup"),
            "hostTimezone": config.host_timezone,
            "deviceIsolationMode": config.device_isolation_mode,
            "deviceProfileId": config.device_profile_id,
            "sessionsRoot": config.sessions_root,
            "statusRoot": config.status_root,
            "terminalPath": config.terminal_path,
            "startedAt": started_at.isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "lastError": last_error,
            "pinnedConnectionId": pinned_connection_id,
            "activeConnections": serialize_active_connections(active_connections),
        }
    )


def process_connection(
    client: ControlPlaneClient,
    adapter: Any,
    config: WorkerConfig,
    connection_id: str,
    lookback_days: int,
    *,
    enforce_live_lease: bool,
) -> ActiveConnectionState:
    bootstrap = client.get_connection(connection_id)
    if enforce_live_lease:
        assert_connection_is_live(bootstrap, connection_id)
    host_policy_violation = validate_connection_host_policy(config, bootstrap)
    if host_policy_violation is not None:
        raise InactiveConnectionError(
            connection_id,
            reason="host_policy_mismatch",
            meta=host_policy_violation,
        )

    session_key = f"{config.worker_id}:{connection_id}"
    worker_host_meta = build_worker_host_policy_meta(config)

    best_effort_report_status(
        client,
        config.worker_id,
        connection_id=connection_id,
        worker_host_id=config.worker_id,
        host_id=config.host_id,
        status="bootstrapping",
        session_key=session_key,
        meta={
            "phase": "bootstrap",
            **worker_host_meta,
        },
    )

    frame = adapter.collect_frame(bootstrap, lookback_days=lookback_days)
    session_meta = frame.get("session", {}).get("meta", {}) or {}
    frame["session"] = {
        **frame.get("session", {}),
        "workerHostId": config.worker_id,
        "sessionKey": session_key,
        "status": "syncing",
        "heartbeatAt": to_api_timestamp(datetime.now(timezone.utc)),
        "meta": {
            **session_meta,
            **worker_host_meta,
        },
    }

    result = client.ingest_sync(frame)
    synced_at = datetime.now(timezone.utc)
    session_meta = frame.get("session", {}).get("meta", {})
    copy_signals = client.get_copy_signals(connection_id)
    copy_results = adapter.execute_copy_signals(bootstrap, copy_signals)

    for copy_result in copy_results:
        client.ack_copy_signal(
            signal_id=str(copy_result.get("signalId", "")),
            success=bool(copy_result.get("success", False)),
            slave_ticket=(
                str(copy_result["slaveTicket"])
                if copy_result.get("slaveTicket") is not None
                else None
            ),
            executed_price=(
                float(copy_result["executedPrice"])
                if copy_result.get("executedPrice") is not None
                else None
            ),
            slippage_pips=(
                float(copy_result["slippagePips"])
                if copy_result.get("slippagePips") is not None
                else None
            ),
            profit=(
                float(copy_result["profit"])
                if copy_result.get("profit") is not None
                else None
            ),
            error_message=(
                str(copy_result["errorMessage"])
                if copy_result.get("errorMessage") is not None
                else None
            ),
        )

    copy_success_count = sum(
        1 for copy_result in copy_results if copy_result.get("success") is True
    )
    copy_failure_count = len(copy_results) - copy_success_count
    final_meta = {
        **session_meta,
        "lastSyncedAt": synced_at.isoformat(),
        "lastResult": result,
        "copySignalsFetched": len(copy_signals),
        "copySignalsExecuted": copy_success_count,
        "copySignalsFailed": copy_failure_count,
    }

    print(
        f"[mt5-worker {config.worker_id}] synced {connection_id}: "
        f"deals={result.get('dealEventsInserted', 0)} "
        f"trades={result.get('tradesProjected', 0)} "
        f"positions={result.get('openPositionsUpserted', 0)} "
        f"copySignals={len(copy_signals)} "
        f"copyExecuted={copy_success_count} "
        f"copyFailed={copy_failure_count}"
    )

    return ActiveConnectionState(
        connection_id=connection_id,
        session_key=session_key,
        last_meta=final_meta,
        last_synced_at=synced_at,
        last_heartbeat_at=synced_at,
    )


def emit_idle_heartbeats(
    client: ControlPlaneClient,
    adapter: Any,
    active_connections: dict[str, ActiveConnectionState],
    worker_id: str,
    host_id: str,
    heartbeat_seconds: int,
    processed_connection_ids: set[str],
) -> None:
    now = datetime.now(timezone.utc)
    stale_after_seconds = max(heartbeat_seconds * 6, 120)
    stale_connection_ids: list[str] = []

    for connection_id, state in active_connections.items():
        if connection_id in processed_connection_ids:
            continue

        inactive_seconds = (now - state.last_synced_at).total_seconds()
        if inactive_seconds >= stale_after_seconds:
            stale_connection_ids.append(connection_id)
            continue

        age_seconds = (now - state.last_heartbeat_at).total_seconds()
        if age_seconds < heartbeat_seconds:
            continue

        delivered = best_effort_report_status(
            client,
            worker_id,
            connection_id=connection_id,
            worker_host_id=worker_id,
            host_id=host_id,
            status="active",
            session_key=state.session_key,
            meta={
                "phase": "idle",
                **state.last_meta,
                "lastSyncedAt": state.last_synced_at.isoformat(),
            },
        )
        if delivered:
            state.last_heartbeat_at = now

    for connection_id in stale_connection_ids:
        active_connections.pop(connection_id, None)
        best_effort_release_connection(adapter, worker_id, connection_id)


def main() -> int:
    parser = argparse.ArgumentParser(description="Profitabledge MT5 worker")
    parser.add_argument("--once", action="store_true", help="Process one loop and exit")
    parser.add_argument(
        "--connection-id",
        help="Process a single connection id instead of claiming work",
    )
    args = parser.parse_args()

    config = load_config()
    client = ControlPlaneClient(
        config.server_url,
        config.worker_secret,
        timeout_seconds=config.http_timeout_seconds,
        retry_count=config.http_retry_count,
        retry_backoff_seconds=config.http_retry_backoff_seconds,
    )
    adapter = build_adapter(config)
    active_connections: dict[str, ActiveConnectionState] = {}
    started_at = datetime.now(timezone.utc)
    status_writer = WorkerStatusWriter(config.status_root, config.worker_id)
    last_error: str | None = None

    ping = client.ping()
    log_message(
        config.worker_id,
        f"control plane reachable at {config.server_url}: {ping}",
    )
    write_worker_status(
        status_writer,
        config,
        started_at=started_at,
        active_connections=active_connections,
        state="running",
        phase="idle",
        pinned_connection_id=args.connection_id,
    )

    try:
        exit_after_cycle = bool(args.connection_id) or args.once
        while True:
            loop_error: str | None = None
            fatal_error = False
            try:
                claimed = []
                if args.connection_id:
                    claimed = [
                        {
                            "connectionId": args.connection_id,
                            "claimMode": "cold",
                            "enforceLiveLease": False,
                        }
                    ]
                else:
                    claimed = client.claim_connections(
                        host_id=config.host_id,
                        worker_id=config.worker_id,
                        limit=config.claim_limit,
                        host=build_claim_host_payload(config),
                    )
                    if claimed:
                        log_message(
                            config.worker_id,
                            f"claimed {len(claimed)} connection(s)",
                        )

                for connection in claimed:
                    connection_id = connection["connectionId"]
                    claim_mode = str(connection.get("claimMode", "cold"))
                    enforce_live_lease = bool(connection.get("enforceLiveLease", False))
                    try:
                        state = process_connection(
                            client=client,
                            adapter=adapter,
                            config=config,
                            connection_id=connection_id,
                            lookback_days=config.lookback_days,
                            enforce_live_lease=enforce_live_lease,
                        )
                        best_effort_release_connection(
                            adapter,
                            config.worker_id,
                            connection_id,
                        )
                        best_effort_report_status(
                            client,
                            config.worker_id,
                            connection_id=connection_id,
                            worker_host_id=config.worker_id,
                            host_id=config.host_id,
                            status="idle",
                            session_key=state.session_key,
                            meta={
                                **state.last_meta,
                                "phase": "queued",
                                "sleepReason": "short_sync_complete",
                                "claimMode": claim_mode,
                                "enforceLiveLease": enforce_live_lease,
                                "queuedAt": datetime.now(timezone.utc).isoformat(),
                            },
                        )
                        log_message(
                            config.worker_id,
                            f"synced and queued {connection_id}",
                        )
                    except InactiveConnectionError as error:
                        best_effort_release_connection(
                            adapter,
                            config.worker_id,
                            connection_id,
                        )
                        best_effort_report_status(
                            client,
                            config.worker_id,
                            connection_id=connection_id,
                            worker_host_id=config.worker_id,
                            host_id=config.host_id,
                            status="sleeping",
                            session_key=f"{config.worker_id}:{connection_id}",
                            meta={
                                **error.meta,
                                "phase": "queued",
                                "sleepReason": error.reason,
                                "claimMode": claim_mode,
                                "enforceLiveLease": enforce_live_lease,
                                "queuedAt": datetime.now(timezone.utc).isoformat(),
                            },
                        )
                        log_message(
                            config.worker_id,
                            f"released {connection_id}: {error.reason}",
                        )
                    except Exception as error:  # noqa: BLE001
                        retryable_control_plane_error = is_retryable_control_plane_error(
                            error
                        )
                        best_effort_release_connection(
                            adapter,
                            config.worker_id,
                            connection_id,
                        )
                        if not retryable_control_plane_error:
                            best_effort_report_status(
                                client,
                                config.worker_id,
                                connection_id=connection_id,
                                worker_host_id=config.worker_id,
                                host_id=config.host_id,
                                status="error",
                                session_key=f"{config.worker_id}:{connection_id}",
                                last_error=str(error),
                                meta={
                                    "phase": "error",
                                    **build_worker_host_policy_meta(config),
                                    "claimMode": claim_mode,
                                    "enforceLiveLease": enforce_live_lease,
                                },
                            )
                            log_message(
                                config.worker_id,
                                f"failed {connection_id}: {error}",
                                error=True,
                            )
                        else:
                            loop_error = str(error)
                            log_message(
                                config.worker_id,
                                f"temporary control-plane error for {connection_id}: {error}",
                            )
                        fatal_error = fatal_error or not retryable_control_plane_error

                last_error = loop_error
                write_worker_status(
                    status_writer,
                    config,
                    started_at=started_at,
                    active_connections=active_connections,
                    state="running" if not fatal_error else "degraded",
                    phase="idle" if not fatal_error else "error",
                    last_error=last_error,
                    pinned_connection_id=args.connection_id,
                )

            except Exception as error:  # noqa: BLE001
                last_error = str(error)
                retryable_control_plane_error = is_retryable_control_plane_error(error)
                log_message(
                    config.worker_id,
                    (
                        f"loop temporarily degraded: {error}"
                        if retryable_control_plane_error
                        else f"loop failed: {error}"
                    ),
                    error=not retryable_control_plane_error,
                )
                write_worker_status(
                    status_writer,
                    config,
                    started_at=started_at,
                    active_connections=active_connections,
                    state="running" if retryable_control_plane_error else "degraded",
                    phase="idle" if retryable_control_plane_error else "error",
                    last_error=last_error,
                    pinned_connection_id=args.connection_id,
                )
                if exit_after_cycle:
                    write_worker_status(
                        status_writer,
                        config,
                        started_at=started_at,
                        active_connections=active_connections,
                        state="stopped",
                        phase="error",
                        last_error=last_error,
                        pinned_connection_id=args.connection_id,
                    )
                    return 1

            if exit_after_cycle:
                write_worker_status(
                    status_writer,
                    config,
                    started_at=started_at,
                    active_connections=active_connections,
                    state="stopped" if not fatal_error else "degraded",
                    phase="idle" if not fatal_error else "error",
                    last_error=last_error,
                    pinned_connection_id=args.connection_id,
                )
                return 1 if fatal_error else 0

            time.sleep(config.poll_seconds)
    finally:
        try:
            adapter.close()
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    raise SystemExit(main())
