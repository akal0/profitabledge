from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from runtime import build_worker_runtime_meta, to_api_timestamp

from .base import MtAdapter


class MockMtAdapter(MtAdapter):
    def collect_frame(self, bootstrap: dict[str, Any], lookback_days: int) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        opened_at = now - timedelta(minutes=75)
        closed_at = now - timedelta(minutes=20)
        connection_id = bootstrap["connectionId"]
        credentials = bootstrap["credentials"]
        worker_meta = build_worker_runtime_meta(mode="mock")

        return {
            "connectionId": connection_id,
            "session": {
                "workerHostId": "mock-worker",
                "sessionKey": f"mock-{connection_id}",
                "status": "syncing",
                "heartbeatAt": to_api_timestamp(now),
                "lastLoginAt": to_api_timestamp(now - timedelta(minutes=80)),
                "meta": {
                    "adapter": "mock",
                    "lookbackDays": lookback_days,
                    **worker_meta,
                },
            },
            "account": {
                "login": credentials["login"],
                "serverName": credentials["server"],
                "brokerName": bootstrap.get("meta", {}).get("brokerName", "Mock Broker"),
                "currency": "USD",
                "leverage": 100,
                "balance": 10245.5,
                "equity": 10302.1,
                "margin": 245.33,
                "freeMargin": 10056.77,
                "marginLevel": 4198.4,
                "snapshotTime": to_api_timestamp(now),
                "rawPayload": {
                    "adapter": "mock",
                    "_pe": worker_meta,
                    "snapshotKind": "account",
                },
            },
            "positions": [
                {
                    "remotePositionId": "91002",
                    "side": "sell",
                    "symbol": "GBPUSD",
                    "volume": 0.5,
                    "openPrice": 1.2674,
                    "currentPrice": 1.2649,
                    "profit": 125.0,
                    "swap": -0.5,
                    "commission": -3.5,
                    "sl": 1.2705,
                    "tp": 1.2605,
                    "comment": "mock open position",
                    "magicNumber": 0,
                    "openTime": to_api_timestamp(now - timedelta(minutes=15)),
                    "snapshotTime": to_api_timestamp(now),
                    "rawPayload": {
                        "adapter": "mock",
                        "_pe": worker_meta,
                        "snapshotKind": "position",
                    },
                }
            ],
            "deals": [
                {
                    "remoteDealId": "81001",
                    "remoteOrderId": "71001",
                    "positionId": "91001",
                    "entryType": "in",
                    "side": "buy",
                    "symbol": "EURUSD",
                    "volume": 1.0,
                    "price": 1.0820,
                    "profit": 0.0,
                    "commission": -3.5,
                    "swap": 0.0,
                    "fee": 0.0,
                    "sl": 1.0790,
                    "tp": 1.0880,
                    "comment": "mock entry",
                    "eventTime": to_api_timestamp(opened_at),
                    "rawPayload": {
                        "adapter": "mock",
                        "_pe": worker_meta,
                        "time_msc": int(opened_at.timestamp() * 1000),
                    },
                },
                {
                    "remoteDealId": "81002",
                    "remoteOrderId": "71001",
                    "positionId": "91001",
                    "entryType": "out",
                    "side": "sell",
                    "symbol": "EURUSD",
                    "volume": 1.0,
                    "price": 1.0846,
                    "profit": 260.0,
                    "commission": -3.5,
                    "swap": -0.7,
                    "fee": 0.0,
                    "sl": 1.0790,
                    "tp": 1.0880,
                    "comment": "mock exit",
                    "eventTime": to_api_timestamp(closed_at),
                    "rawPayload": {
                        "adapter": "mock",
                        "_pe": worker_meta,
                        "time_msc": int(closed_at.timestamp() * 1000),
                    },
                },
            ],
            "orders": [
                {
                    "eventKey": "71001-created",
                    "remoteOrderId": "71001",
                    "positionId": "91001",
                    "side": "buy",
                    "orderType": "market",
                    "state": "filled",
                    "symbol": "EURUSD",
                    "requestedVolume": 1.0,
                    "filledVolume": 1.0,
                    "price": 1.0820,
                    "sl": 1.0790,
                    "tp": 1.0880,
                    "comment": "mock order",
                    "eventTime": to_api_timestamp(opened_at),
                    "rawPayload": {
                        "adapter": "mock",
                        "_pe": worker_meta,
                        "time_setup_msc": int(opened_at.timestamp() * 1000),
                    },
                }
            ],
            "priceSnapshots": [
                {
                    "symbol": "EURUSD",
                    "bid": 1.0820,
                    "ask": 1.0822,
                    "timestamp": to_api_timestamp(opened_at),
                    "bidVolume": 10,
                    "askVolume": 10,
                },
                {
                    "symbol": "EURUSD",
                    "bid": 1.0846,
                    "ask": 1.0848,
                    "timestamp": to_api_timestamp(closed_at),
                    "bidVolume": 14,
                    "askVolume": 13,
                },
                {
                    "symbol": "GBPUSD",
                    "bid": 1.2649,
                    "ask": 1.2651,
                    "timestamp": to_api_timestamp(now),
                    "bidVolume": 9,
                    "askVolume": 8,
                },
            ],
            "checkpoint": {
                "lastDealTime": to_api_timestamp(closed_at),
                "lastDealId": "81002",
                "lastOrderTime": to_api_timestamp(opened_at),
                "lastPositionPollAt": to_api_timestamp(now),
                "lastAccountPollAt": to_api_timestamp(now),
            },
        }
