import json
import os
import ssl
import time
import urllib.error
import urllib.request
from typing import Any

try:
    import certifi
except ImportError:  # pragma: no cover - optional dependency in dev
    certifi = None


class ControlPlaneRequestError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        retryable: bool,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.status_code = status_code


class ControlPlaneClient:
    def __init__(
        self,
        server_url: str,
        worker_secret: str,
        *,
        timeout_seconds: int = 30,
        retry_count: int = 4,
        retry_backoff_seconds: float = 1.5,
    ) -> None:
        self.server_url = server_url.rstrip("/")
        self.worker_secret = worker_secret
        self.timeout_seconds = timeout_seconds
        self.retry_count = retry_count
        self.retry_backoff_seconds = retry_backoff_seconds
        self.ssl_context = self._build_ssl_context()

    def _build_ssl_context(self) -> ssl.SSLContext:
        explicit_ca_file = os.getenv("PE_SSL_CERT_FILE", "").strip() or os.getenv(
            "SSL_CERT_FILE", ""
        ).strip()
        if explicit_ca_file:
            return ssl.create_default_context(cafile=explicit_ca_file)

        if certifi is not None:
            return ssl.create_default_context(cafile=certifi.where())

        return ssl.create_default_context()

    def _should_retry_http_error(self, status_code: int) -> bool:
        return status_code in {408, 425, 429, 500, 502, 503, 504}

    def _request_error(
        self,
        method: str,
        target: str,
        detail: str,
        *,
        retryable: bool,
        status_code: int | None = None,
    ) -> ControlPlaneRequestError:
        return ControlPlaneRequestError(
            f"{method} {target} failed: {detail}",
            retryable=retryable,
            status_code=status_code,
        )

    def _socket_error_hint(self, error: urllib.error.URLError) -> str:
        reason = getattr(error, "reason", None)
        if isinstance(reason, OSError) and getattr(reason, "winerror", None) == 10013:
            return (
                " Check PE_SERVER_URL, avoid bind-only addresses such as 0.0.0.0 or ::, "
                "and verify Windows firewall, antivirus, and proxy rules for Python."
            )
        return ""

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        data = None
        headers = {
            "Content-Type": "application/json",
            "x-worker-secret": self.worker_secret,
            "Connection": "close",
        }

        if payload is not None:
            data = json.dumps(payload).encode("utf-8")

        target = f"{self.server_url}{path}"
        request = urllib.request.Request(
            target,
            data=data,
            headers=headers,
            method=method,
        )

        last_error: Exception | None = None
        for attempt in range(self.retry_count + 1):
            try:
                with urllib.request.urlopen(
                    request,
                    timeout=self.timeout_seconds,
                    context=self.ssl_context,
                ) as response:
                    raw = response.read().decode("utf-8")
                break
            except urllib.error.HTTPError as error:
                body = error.read().decode("utf-8")
                last_error = self._request_error(
                    method,
                    target,
                    f"{error.code} {body}",
                    retryable=self._should_retry_http_error(error.code),
                    status_code=error.code,
                )
                if (
                    attempt < self.retry_count
                    and self._should_retry_http_error(error.code)
                ):
                    time.sleep(self.retry_backoff_seconds * (attempt + 1))
                    continue
                raise last_error from error
            except urllib.error.URLError as error:
                last_error = self._request_error(
                    method,
                    target,
                    f"{error}{self._socket_error_hint(error)}",
                    retryable=True,
                )
                if attempt < self.retry_count:
                    time.sleep(self.retry_backoff_seconds * (attempt + 1))
                    continue
                raise last_error from error
        else:
            if last_error is not None:
                raise last_error
            raise RuntimeError(f"{method} {path} failed without a response")

        parsed = json.loads(raw)
        if parsed.get("success") is False:
            raise RuntimeError(parsed.get("error", f"{method} {path} returned error"))

        return parsed

    def ping(self) -> dict[str, Any]:
        return self._request("GET", "/api/mt5-worker/ping")

    def claim_connections(
        self,
        *,
        host_id: str,
        worker_id: str,
        limit: int,
        host: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        response = self._request(
            "POST",
            "/api/mt5-worker/claim",
            {
                "hostId": host_id,
                "workerId": worker_id,
                "limit": limit,
                "host": host or {},
            },
        )
        return response.get("connections", [])

    def get_connection(self, connection_id: str) -> dict[str, Any]:
        response = self._request(
            "GET",
            f"/api/mt5-worker/connections/{connection_id}",
        )
        return response["connection"]

    def report_status(
        self,
        connection_id: str,
        worker_host_id: str,
        status: str,
        host_id: str | None = None,
        session_key: str | None = None,
        last_error: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/mt5-worker/status",
            {
                "connectionId": connection_id,
                "workerHostId": worker_host_id,
                "hostId": host_id,
                "workerId": worker_host_id,
                "status": status,
                "sessionKey": session_key,
                "lastError": last_error,
                "meta": meta or {},
            },
        )

    def report_host_status(
        self,
        worker_host_id: str,
        snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "/api/mt5-worker/host-status",
            {
                "workerHostId": worker_host_id,
                "snapshot": snapshot,
            },
        )

    def ingest_sync(self, frame: dict[str, Any]) -> dict[str, Any]:
        response = self._request(
            "POST",
            "/api/mt5-worker/sync",
            {
                "frame": frame,
            },
        )
        return response["result"]


def is_retryable_control_plane_error(error: Exception) -> bool:
    return isinstance(error, ControlPlaneRequestError) and error.retryable
