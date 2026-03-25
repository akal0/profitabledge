from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from runtime import (
    TerminalSession,
    TerminalSessionManager,
    build_worker_runtime_meta,
    snapshot_mt5_record,
    to_api_timestamp,
)

from .base import MtAdapter

ENTRY_MAP = {
    0: "in",
    1: "out",
    2: "inout",
    3: "out_by",
}

SIDE_MAP = {
    0: "buy",
    1: "sell",
}

COPY_MAGIC_NUMBER = 12345678
COPY_COMMENT_PREFIX = "Copied: "
DEFAULT_COPY_MAX_SLIPPAGE_PIPS = 3.0
TRADE_RETCODE_INVALID_FILL = 10030


@dataclass
class ActivePositionState:
    trade_key: str
    symbol: str
    side: str
    entry_expected_price: float | None = None
    entry_spread_pips: float | None = None
    last_bid: float | None = None
    last_ask: float | None = None
    last_quote_time: datetime | None = None


@dataclass
class PostExitTrackingState:
    trade_key: str
    symbol: str
    side: str
    close_time: datetime
    tracking_end_time: datetime
    entry_expected_price: float | None = None
    entry_spread_pips: float | None = None
    last_bid: float | None = None
    last_ask: float | None = None
    last_quote_time: datetime | None = None
    exit_reference_bid: float | None = None
    exit_reference_ask: float | None = None
    exit_reference_time: datetime | None = None


@dataclass
class ConnectionRuntimeState:
    active_positions: dict[str, ActivePositionState] = field(default_factory=dict)
    post_exit_positions: dict[str, PostExitTrackingState] = field(default_factory=dict)
    last_tick_sent_at_by_symbol: dict[str, datetime] = field(default_factory=dict)
    has_completed_initial_full_reconcile: bool = False


class MetaTrader5Adapter(MtAdapter):
    def __init__(
        self,
        terminal_path: str | None,
        *,
        terminal_path_map: dict[str, str] | None,
        sessions_root: str,
        initialize_timeout_ms: int,
        connected_timeout_seconds: int,
        history_overlap_seconds: int,
        history_future_seconds: int,
        tick_replay_seconds: int,
        full_reconcile_minutes: int,
        post_exit_tracking_seconds: int,
    ) -> None:
        if os.name != "nt":
            raise RuntimeError("MT5 terminal mode requires a Windows host")
        if not terminal_path:
            raise RuntimeError(
                "MT5_TERMINAL_PATH is required for terminal mode so the worker can create "
                "per-account portable runtime directories"
            )

        try:
            import MetaTrader5 as mt5  # type: ignore
        except ImportError as error:
            raise RuntimeError(
                "MetaTrader5 Python package is required for terminal mode"
            ) from error

        self.mt5 = mt5
        self.initialize_timeout_ms = initialize_timeout_ms
        self.connected_timeout_seconds = connected_timeout_seconds
        self.history_overlap_seconds = history_overlap_seconds
        self.history_future_seconds = history_future_seconds
        self.tick_replay_seconds = tick_replay_seconds
        self.full_reconcile_minutes = full_reconcile_minutes
        self.post_exit_tracking_seconds = post_exit_tracking_seconds
        self.session_manager = TerminalSessionManager(
            template_path=terminal_path,
            sessions_root=sessions_root,
            template_path_map=terminal_path_map,
        )
        self.connection_states: dict[str, ConnectionRuntimeState] = {}
        self.active_connection_id: str | None = None
        self.active_terminal_path: str | None = None
        self.active_login: int | None = None
        self.active_server: str | None = None

    def collect_frame(
        self, bootstrap: dict[str, Any], lookback_days: int
    ) -> dict[str, Any]:
        credentials = bootstrap["credentials"]
        checkpoint = bootstrap.get("checkpoint") or {}
        connection_id = bootstrap["connectionId"]
        login = int(credentials["login"])
        password = credentials["password"]
        server = credentials["server"]
        runtime_state = self._get_connection_state(connection_id)

        session = self.session_manager.prepare_session(bootstrap)

        try:
            self._initialize_terminal(session, login=login, password=password, server=server)

            now = datetime.now(timezone.utc)
            full_reconcile = self._should_run_full_reconcile(
                checkpoint,
                now=now,
                runtime_state=runtime_state,
                bootstrap_meta=bootstrap.get("meta") or {},
            )
            deals_start = self._history_window_start(
                checkpoint.get("lastDealTime"),
                now=now,
                lookback_days=lookback_days,
                force_full=full_reconcile,
            )
            orders_start = self._history_window_start(
                checkpoint.get("lastOrderTime"),
                now=now,
                lookback_days=lookback_days,
                force_full=full_reconcile,
            )
            history_end = self._history_window_end(now)

            account_info = self.mt5.account_info()
            if account_info is None:
                raise RuntimeError(f"MetaTrader5 account_info failed: {self.mt5.last_error()}")
            terminal_info = self.mt5.terminal_info()
            terminal_version = self.mt5.version()

            positions = self.mt5.positions_get() or []
            deals = self.mt5.history_deals_get(deals_start, history_end) or []
            orders = self.mt5.history_orders_get(orders_start, history_end) or []
            supplemental_position_ids = self._collect_position_ids_for_supplementation(
                positions=positions,
                deals=deals,
                orders=orders,
                full_reconcile=full_reconcile,
            )
            supplemental_deals, supplemental_orders = self._collect_position_history_supplements(
                position_ids=supplemental_position_ids,
            )
            all_deals = self._merge_unique_deals(deals, supplemental_deals)
            all_orders = self._merge_unique_orders(orders, supplemental_orders)
            filtered_deals = self._filter_trade_deals(all_deals)
            ledger_deals = self._filter_ledger_deals(all_deals)
            runtime_state = self._update_connection_state(
                connection_id,
                positions=positions,
                deals=filtered_deals,
                now=now,
            )
            spec_symbols = self._collect_tracked_symbols(
                positions=positions,
                deals=filtered_deals,
                orders=all_orders,
                post_exit_positions=runtime_state.post_exit_positions,
            )
            quote_symbols = self._collect_quote_symbols(
                positions=positions,
                post_exit_positions=runtime_state.post_exit_positions,
            )
            symbol_specs = self._collect_symbol_specs(symbols=spec_symbols, now=now)
            price_snapshots = self._collect_price_snapshots(
                runtime_state=runtime_state,
                tracked_symbols=quote_symbols,
                now=now,
            )
            self._apply_price_snapshots_to_connection_state(
                runtime_state=runtime_state,
                price_snapshots=price_snapshots,
            )
            execution_contexts = self._build_execution_contexts(runtime_state)

            self.session_manager.mark_collect(session)
            self.session_manager.mark_heartbeat(session)
            worker_meta = self._build_worker_meta(
                terminal_version=terminal_version,
                history_mode="full-reconcile" if full_reconcile else "incremental",
            )
            session_meta = self.session_manager.build_session_meta(
                session,
                lookback_days=lookback_days,
            )
            session_meta.update(
                {
                    **worker_meta,
                    "historyMode": "full-reconcile" if full_reconcile else "incremental",
                    "dealHistoryFrom": to_api_timestamp(deals_start),
                    "orderHistoryFrom": to_api_timestamp(orders_start),
                    "historyEnd": to_api_timestamp(history_end),
                    "historyOverlapSeconds": self.history_overlap_seconds,
                    "historyFutureSeconds": self.history_future_seconds,
                    "fullReconcileMinutes": self.full_reconcile_minutes,
                    "postExitTrackingSeconds": self.post_exit_tracking_seconds,
                }
            )
            if ledger_deals:
                session_meta["ledgerEventCount"] = len(ledger_deals)
            session_meta["postExitTrackedPositions"] = len(
                runtime_state.post_exit_positions
            )
            session_meta["supplementedPositionCount"] = len(supplemental_position_ids)
            session_meta["supplementalDealCount"] = max(
                0, len(filtered_deals) - len(self._filter_trade_deals(deals))
            )
            session_meta["supplementalOrderCount"] = max(
                0, len(all_orders) - len(orders)
            )
            session_meta["executionContextCount"] = len(execution_contexts)
            session_meta["symbolSpecCount"] = len(symbol_specs)
            session_meta["priceSnapshotCount"] = len(price_snapshots)
            session_meta["trackedSymbols"] = sorted(quote_symbols)
            session_meta["symbolSpecSymbols"] = sorted(spec_symbols)
            if isinstance(bootstrap.get("meta"), dict) and isinstance(
                bootstrap["meta"].get("gapHeal"), dict
            ):
                session_meta["gapHeal"] = bootstrap["meta"]["gapHeal"]

            frame = {
                "connectionId": connection_id,
                "session": {
                    "status": "syncing",
                    "heartbeatAt": to_api_timestamp(now),
                    "lastLoginAt": (
                        to_api_timestamp(session.last_login_at)
                        if session.last_login_at
                        else to_api_timestamp(now)
                    ),
                    "meta": session_meta,
                },
                "account": {
                    "login": str(getattr(account_info, "login", login)),
                    "serverName": str(getattr(account_info, "server", server)),
                    "brokerName": str(
                        getattr(account_info, "company", "MetaTrader Broker")
                    ),
                    "currency": str(getattr(account_info, "currency", "USD")),
                    "leverage": int(getattr(account_info, "leverage", 0) or 0),
                    "balance": float(getattr(account_info, "balance", 0.0)),
                    "equity": float(getattr(account_info, "equity", 0.0)),
                    "margin": float(getattr(account_info, "margin", 0.0)),
                    "freeMargin": float(getattr(account_info, "margin_free", 0.0)),
                    "marginLevel": float(getattr(account_info, "margin_level", 0.0)),
                    "snapshotTime": to_api_timestamp(now),
                    "rawPayload": {
                        **snapshot_mt5_record(account_info),
                        "_pe": {
                            **worker_meta,
                            "sessionRoot": str(session.session_root),
                            "terminalInfo": snapshot_mt5_record(terminal_info)
                            if terminal_info is not None
                            else None,
                            "terminalVersion": terminal_version,
                        },
                    },
                },
                "positions": [
                    {
                        "remotePositionId": str(getattr(position, "ticket", "")),
                        "side": SIDE_MAP.get(int(getattr(position, "type", 0)), "buy"),
                        "symbol": str(getattr(position, "symbol", "")),
                        "volume": float(getattr(position, "volume", 0.0)),
                        "openPrice": float(getattr(position, "price_open", 0.0)),
                        "currentPrice": float(getattr(position, "price_current", 0.0)),
                        "profit": float(getattr(position, "profit", 0.0)),
                        "swap": float(getattr(position, "swap", 0.0)),
                        "commission": float(getattr(position, "commission", 0.0)),
                        "sl": float(getattr(position, "sl", 0.0)) or None,
                        "tp": float(getattr(position, "tp", 0.0)) or None,
                        "comment": getattr(position, "comment", None),
                        "magicNumber": int(getattr(position, "magic", 0)),
                        "openTime": to_api_timestamp(self._position_time(position)),
                        "snapshotTime": to_api_timestamp(now),
                        "rawPayload": {
                            **snapshot_mt5_record(position),
                            "_pe": {
                                **worker_meta,
                                "sessionRoot": str(session.session_root),
                            },
                        },
                    }
                    for position in positions
                ],
                "deals": [
                    {
                        "remoteDealId": str(getattr(deal, "ticket", "")),
                        "remoteOrderId": str(getattr(deal, "order", "")),
                        "positionId": str(getattr(deal, "position_id", "")) or None,
                        "entryType": ENTRY_MAP.get(int(getattr(deal, "entry", 0)), "in"),
                        "side": SIDE_MAP.get(int(getattr(deal, "type", 0)), "buy"),
                        "symbol": str(getattr(deal, "symbol", "")).strip(),
                        "volume": float(getattr(deal, "volume", 0.0)),
                        "price": float(getattr(deal, "price", 0.0)),
                        "profit": float(getattr(deal, "profit", 0.0)),
                        "commission": float(getattr(deal, "commission", 0.0)),
                        "swap": float(getattr(deal, "swap", 0.0)),
                        "fee": float(getattr(deal, "fee", 0.0)),
                        "sl": float(getattr(deal, "sl", 0.0)) or None,
                        "tp": float(getattr(deal, "tp", 0.0)) or None,
                        "comment": getattr(deal, "comment", None),
                        "eventTime": to_api_timestamp(self._deal_time(deal)),
                        "rawPayload": {
                            **snapshot_mt5_record(deal),
                            "_pe": {
                                **worker_meta,
                                "sessionRoot": str(session.session_root),
                            },
                        },
                    }
                    for deal in filtered_deals
                ],
                "orders": [
                    {
                        "eventKey": (
                            f"{getattr(order, 'ticket', '')}:"
                            f"{getattr(order, 'state', '')}:"
                            f"{getattr(order, 'time_setup', 0)}"
                        ),
                        "remoteOrderId": str(getattr(order, "ticket", "")),
                        "positionId": str(getattr(order, "position_id", "")) or None,
                        "side": SIDE_MAP.get(int(getattr(order, "type", 0)), "buy"),
                        "orderType": str(getattr(order, "type", "")),
                        "state": str(getattr(order, "state", "")),
                        "symbol": str(getattr(order, "symbol", "")),
                        "requestedVolume": float(
                            getattr(order, "volume_initial", 0.0)
                        ),
                        "filledVolume": float(getattr(order, "volume_current", 0.0)),
                        "price": float(getattr(order, "price_open", 0.0)),
                        "sl": float(getattr(order, "sl", 0.0)) or None,
                        "tp": float(getattr(order, "tp", 0.0)) or None,
                        "comment": getattr(order, "comment", None),
                        "eventTime": to_api_timestamp(self._order_time(order)),
                        "rawPayload": {
                            **snapshot_mt5_record(order),
                            "_pe": {
                                **worker_meta,
                                "sessionRoot": str(session.session_root),
                            },
                        },
                    }
                    for order in all_orders
                ],
                "ledgerEvents": [
                    {
                        "remoteDealId": str(getattr(deal, "ticket", "")),
                        "remoteOrderId": str(getattr(deal, "order", "")) or None,
                        "positionId": str(getattr(deal, "position_id", "")) or None,
                        "ledgerType": self._map_ledger_type(deal),
                        "amount": float(getattr(deal, "profit", 0.0)),
                        "commission": float(getattr(deal, "commission", 0.0)),
                        "swap": float(getattr(deal, "swap", 0.0)),
                        "fee": float(getattr(deal, "fee", 0.0)),
                        "comment": getattr(deal, "comment", None),
                        "eventTime": to_api_timestamp(self._deal_time(deal)),
                        "rawPayload": {
                            **snapshot_mt5_record(deal),
                            "_pe": {
                                **worker_meta,
                                "sessionRoot": str(session.session_root),
                            },
                        },
                    }
                    for deal in ledger_deals
                ],
                "executionContexts": execution_contexts,
                "symbolSpecs": symbol_specs,
                "priceSnapshots": price_snapshots,
                "checkpoint": {
                    "lastPositionPollAt": to_api_timestamp(now),
                    "lastAccountPollAt": to_api_timestamp(now),
                },
            }

            if filtered_deals:
                last_deal = max(
                    filtered_deals,
                    key=lambda deal: self._sort_timestamp_ms(
                        getattr(deal, "time_msc", None),
                        getattr(deal, "time", 0),
                    ),
                )
                frame["checkpoint"]["lastDealTime"] = to_api_timestamp(
                    self._deal_time(last_deal)
                )
                frame["checkpoint"]["lastDealId"] = str(
                    getattr(last_deal, "ticket", "")
                )

            if all_orders:
                last_order = max(
                    all_orders,
                    key=lambda order: self._sort_timestamp_ms(
                        getattr(order, "time_setup_msc", None),
                        getattr(order, "time_setup", 0),
                    ),
                )
                frame["checkpoint"]["lastOrderTime"] = to_api_timestamp(
                    self._order_time(last_order)
                )
            if full_reconcile:
                frame["checkpoint"]["lastFullReconcileAt"] = to_api_timestamp(now)
                runtime_state.has_completed_initial_full_reconcile = True

            return frame
        except Exception as error:  # noqa: BLE001
            self.session_manager.mark_failure(session, str(error))
            self._reset_terminal_session()
            raise

    def execute_copy_signals(
        self,
        bootstrap: dict[str, Any],
        signals: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        if not signals:
            return []

        credentials = bootstrap["credentials"]
        session = self.session_manager.prepare_session(bootstrap)
        login = int(credentials["login"])
        password = credentials["password"]
        server = credentials["server"]

        self._initialize_terminal(session, login=login, password=password, server=server)

        results: list[dict[str, Any]] = []
        for signal in signals:
            try:
                results.append(self._execute_copy_signal(signal))
            except Exception as error:  # noqa: BLE001
                results.append(
                    {
                        "signalId": str(signal.get("id", "")),
                        "success": False,
                        "errorMessage": str(error),
                    }
                )

        return results

    def _execute_copy_signal(self, signal: dict[str, Any]) -> dict[str, Any]:
        signal_type = str(signal.get("signalType", "") or "").strip().lower()

        if signal_type == "open":
            return self._execute_copy_open(signal)
        if signal_type == "close":
            return self._execute_copy_close(signal)
        if signal_type == "modify":
            return self._execute_copy_modify(signal)

        return {
            "signalId": str(signal.get("id", "")),
            "success": False,
            "errorMessage": f"Unsupported copy signal type: {signal_type or 'unknown'}",
        }

    def _execute_copy_open(self, signal: dict[str, Any]) -> dict[str, Any]:
        signal_id = str(signal.get("id", ""))
        symbol = str(signal.get("symbol", "") or "").strip()
        trade_type = str(signal.get("tradeType", "") or "").strip().lower()
        master_ticket = str(signal.get("masterTicket", "") or "").strip()
        requested_volume = float(signal.get("volume") or 0.0)
        existing_position = self._find_copied_position(
            master_ticket,
            symbol or None,
        )

        if existing_position is not None:
            existing_ticket = str(int(getattr(existing_position, "ticket", 0) or 0))
            if existing_ticket == "0":
                existing_ticket = None

            existing_open_price = float(
                getattr(existing_position, "price_open", 0.0) or 0.0
            )

            return {
                "signalId": signal_id,
                "success": True,
                "slaveTicket": existing_ticket,
                "executedPrice": existing_open_price or None,
                "slippagePips": None,
            }

        if not symbol:
            return self._failed_signal(signal_id, "Missing symbol")
        if trade_type not in {"buy", "sell"}:
            return self._failed_signal(signal_id, f"Unsupported trade type: {trade_type}")
        if requested_volume <= 0:
            return self._failed_signal(signal_id, "Invalid copy volume")

        self._ensure_symbol_selected(symbol)
        symbol_info = self.mt5.symbol_info(symbol)
        if symbol_info is None:
            return self._failed_signal(signal_id, f"Symbol unavailable: {symbol}")

        tick = self.mt5.symbol_info_tick(symbol)
        if tick is None:
            return self._failed_signal(signal_id, f"No price tick available for {symbol}")

        volume = self._normalize_order_volume(requested_volume, symbol_info)
        if volume is None or volume <= 0:
            return self._failed_signal(signal_id, f"Unable to normalize volume {requested_volume}")

        order_type = (
            self.mt5.ORDER_TYPE_BUY
            if trade_type == "buy"
            else self.mt5.ORDER_TYPE_SELL
        )
        expected_price = float(getattr(tick, "ask", 0.0) or 0.0) if trade_type == "buy" else float(getattr(tick, "bid", 0.0) or 0.0)
        if expected_price <= 0:
            return self._failed_signal(signal_id, f"Invalid live price for {symbol}")

        digits = int(getattr(symbol_info, "digits", 0) or 0)
        request: dict[str, Any] = {
            "action": self.mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "price": round(expected_price, digits),
            "deviation": self._slippage_to_deviation_points(
                float(signal.get("maxSlippagePips") or DEFAULT_COPY_MAX_SLIPPAGE_PIPS),
                symbol_info,
                symbol,
            ),
            "magic": COPY_MAGIC_NUMBER,
            "comment": f"{COPY_COMMENT_PREFIX}{master_ticket}",
        }

        sl = self._normalize_price(signal.get("sl"), digits)
        tp = self._normalize_price(signal.get("tp"), digits)
        if sl is not None and sl > 0:
            request["sl"] = sl
        if tp is not None and tp > 0:
            request["tp"] = tp

        result, request = self._send_deal_request_with_filling_fallback(
            request=request,
            symbol_info=symbol_info,
        )
        if not self._is_successful_trade_result(result):
            return self._failed_signal(
                signal_id,
                self._trade_result_error("Open", result),
            )

        executed_price = float(getattr(result, "price", 0.0) or request["price"])
        position = self._find_copied_position(master_ticket, symbol)
        slave_ticket = position if position is not None else None
        resolved_ticket = str(
            int(
                getattr(slave_ticket, "ticket", 0)
                or getattr(result, "order", 0)
                or getattr(result, "deal", 0)
                or 0
            )
        )
        if resolved_ticket == "0":
            resolved_ticket = None

        return {
            "signalId": signal_id,
            "success": True,
            "slaveTicket": resolved_ticket,
            "executedPrice": executed_price,
            "slippagePips": self._calculate_slippage_pips(
                symbol=symbol,
                expected_price=expected_price,
                executed_price=executed_price,
                symbol_info=symbol_info,
            ),
        }

    def _execute_copy_close(self, signal: dict[str, Any]) -> dict[str, Any]:
        signal_id = str(signal.get("id", ""))
        master_ticket = str(signal.get("masterTicket", "") or "").strip()
        signal_symbol = str(signal.get("symbol", "") or "").strip() or None
        position = self._find_copied_position(master_ticket, signal_symbol)
        if position is None:
            return self._failed_signal(
                signal_id,
                f"Copied position not found for master ticket {master_ticket}",
            )

        symbol = str(getattr(position, "symbol", "") or "").strip()
        self._ensure_symbol_selected(symbol)
        symbol_info = self.mt5.symbol_info(symbol)
        if symbol_info is None:
            return self._failed_signal(signal_id, f"Symbol unavailable: {symbol}")

        tick = self.mt5.symbol_info_tick(symbol)
        if tick is None:
            return self._failed_signal(signal_id, f"No price tick available for {symbol}")

        position_ticket = int(getattr(position, "ticket", 0) or 0)
        position_type = int(getattr(position, "type", 0) or 0)
        current_volume = float(getattr(position, "volume", 0.0) or 0.0)
        if current_volume <= 0:
            return self._failed_signal(signal_id, "Copied position has no open volume")

        requested_volume = float(signal.get("volume") or 0.0)
        close_volume = requested_volume if requested_volume > 0 else current_volume
        volume = self._normalize_order_volume(min(close_volume, current_volume), symbol_info)
        if volume is None or volume <= 0:
            return self._failed_signal(signal_id, "Unable to normalize close volume")

        digits = int(getattr(symbol_info, "digits", 0) or 0)
        order_type = (
            self.mt5.ORDER_TYPE_SELL
            if position_type == self.mt5.POSITION_TYPE_BUY
            else self.mt5.ORDER_TYPE_BUY
        )
        expected_price = (
            float(getattr(tick, "bid", 0.0) or 0.0)
            if position_type == self.mt5.POSITION_TYPE_BUY
            else float(getattr(tick, "ask", 0.0) or 0.0)
        )
        if expected_price <= 0:
            return self._failed_signal(signal_id, f"Invalid live close price for {symbol}")

        profit = float(getattr(position, "profit", 0.0) or 0.0)
        request = {
            "action": self.mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "position": position_ticket,
            "price": round(expected_price, digits),
            "deviation": self._slippage_to_deviation_points(
                float(signal.get("maxSlippagePips") or DEFAULT_COPY_MAX_SLIPPAGE_PIPS),
                symbol_info,
                symbol,
            ),
            "magic": COPY_MAGIC_NUMBER,
        }

        result, request = self._send_deal_request_with_filling_fallback(
            request=request,
            symbol_info=symbol_info,
        )
        if not self._is_successful_trade_result(result):
            return self._failed_signal(
                signal_id,
                self._trade_result_error("Close", result),
            )

        executed_price = float(getattr(result, "price", 0.0) or request["price"])
        return {
            "signalId": signal_id,
            "success": True,
            "slaveTicket": str(position_ticket),
            "executedPrice": executed_price,
            "slippagePips": self._calculate_slippage_pips(
                symbol=symbol,
                expected_price=float(signal.get("closePrice") or expected_price),
                executed_price=executed_price,
                symbol_info=symbol_info,
            ),
            "profit": profit,
        }

    def _execute_copy_modify(self, signal: dict[str, Any]) -> dict[str, Any]:
        signal_id = str(signal.get("id", ""))
        master_ticket = str(signal.get("masterTicket", "") or "").strip()
        signal_symbol = str(signal.get("symbol", "") or "").strip() or None
        position = self._find_copied_position(master_ticket, signal_symbol)
        if position is None:
            return self._failed_signal(
                signal_id,
                f"Copied position not found for master ticket {master_ticket}",
            )

        symbol = str(getattr(position, "symbol", "") or "").strip()
        self._ensure_symbol_selected(symbol)
        symbol_info = self.mt5.symbol_info(symbol)
        if symbol_info is None:
            return self._failed_signal(signal_id, f"Symbol unavailable: {symbol}")

        digits = int(getattr(symbol_info, "digits", 0) or 0)
        new_sl = self._normalize_price(signal.get("newSl"), digits)
        new_tp = self._normalize_price(signal.get("newTp"), digits)
        if new_sl is None and new_tp is None:
            return self._failed_signal(signal_id, "Modify signal has no SL or TP changes")

        request: dict[str, Any] = {
            "action": self.mt5.TRADE_ACTION_SLTP,
            "position": int(getattr(position, "ticket", 0) or 0),
            "symbol": symbol,
        }

        if new_sl is not None:
            request["sl"] = new_sl
        else:
            current_sl = float(getattr(position, "sl", 0.0) or 0.0)
            if current_sl > 0:
                request["sl"] = round(current_sl, digits)

        if new_tp is not None:
            request["tp"] = new_tp
        else:
            current_tp = float(getattr(position, "tp", 0.0) or 0.0)
            if current_tp > 0:
                request["tp"] = round(current_tp, digits)

        result = self.mt5.order_send(request)
        if not self._is_successful_trade_result(result):
            return self._failed_signal(
                signal_id,
                self._trade_result_error("Modify", result),
            )

        return {
            "signalId": signal_id,
            "success": True,
            "slaveTicket": str(int(getattr(position, "ticket", 0) or 0)),
        }

    def _failed_signal(self, signal_id: str, error_message: str) -> dict[str, Any]:
        return {
            "signalId": signal_id,
            "success": False,
            "errorMessage": error_message,
        }

    def _find_copied_position(self, master_ticket: str, symbol: str | None = None) -> Any | None:
        positions = self.mt5.positions_get() or []
        exact_comment = f"{COPY_COMMENT_PREFIX}{master_ticket}"
        partial_match: Any | None = None

        for position in positions:
            position_symbol = str(getattr(position, "symbol", "") or "").strip()
            if symbol and position_symbol != symbol:
                continue

            comment = str(getattr(position, "comment", "") or "")
            if comment == exact_comment:
                return position
            if comment.startswith(COPY_COMMENT_PREFIX) and master_ticket in comment:
                partial_match = position

        return partial_match

    def _normalize_order_volume(self, requested_volume: float, symbol_info: Any) -> float | None:
        if requested_volume <= 0:
            return None

        volume_min = float(getattr(symbol_info, "volume_min", 0.0) or 0.0)
        volume_max = float(getattr(symbol_info, "volume_max", 0.0) or 0.0)
        volume_step = float(getattr(symbol_info, "volume_step", 0.0) or 0.0)
        if volume_step <= 0:
            volume_step = volume_min if volume_min > 0 else 0.01

        normalized = requested_volume
        if volume_min > 0:
            normalized = max(volume_min, normalized)
        if volume_max > 0:
            normalized = min(volume_max, normalized)

        step_units = int((normalized / volume_step) + 1e-9)
        if step_units <= 0:
            step_units = 1
        normalized = step_units * volume_step

        if volume_min > 0 and normalized < volume_min:
            normalized = volume_min
        if volume_max > 0 and normalized > volume_max:
            normalized = volume_max

        return round(normalized, self._step_digits(volume_step))

    def _step_digits(self, value: float) -> int:
        rendered = f"{value:.10f}".rstrip("0").rstrip(".")
        if "." not in rendered:
            return 0
        return len(rendered.split(".", 1)[1])

    def _normalize_price(self, value: Any, digits: int) -> float | None:
        if value is None:
            return None

        price = float(value)
        if price <= 0:
            return None

        return round(price, digits)

    def _slippage_to_deviation_points(
        self,
        max_slippage_pips: float,
        symbol_info: Any,
        symbol: str,
    ) -> int:
        point_size = float(getattr(symbol_info, "point", 0.0) or 0.0)
        tick_size = float(
            getattr(symbol_info, "trade_tick_size", 0.0) or point_size or 0.0
        )
        digits = int(getattr(symbol_info, "digits", 0) or 0) or None
        pip_size = self._pip_size(
            symbol,
            digits=digits,
            point_size=point_size if point_size > 0 else None,
            tick_size=tick_size if tick_size > 0 else None,
        )
        if point_size <= 0 or pip_size <= 0:
            return max(int(round(max_slippage_pips * 10)), 1)

        return max(int(round((max_slippage_pips * pip_size) / point_size)), 1)

    def _send_deal_request_with_filling_fallback(
        self,
        *,
        request: dict[str, Any],
        symbol_info: Any,
    ) -> tuple[Any, dict[str, Any]]:
        last_result: Any = None
        last_request = dict(request)

        for filling_type in self._build_filling_type_candidates(symbol_info):
            next_request = dict(request)
            next_request["type_filling"] = filling_type
            result = self.mt5.order_send(next_request)
            last_result = result
            last_request = next_request

            if self._is_successful_trade_result(result):
                return result, next_request

            retcode = int(getattr(result, "retcode", 0) or 0) if result is not None else 0
            if retcode != TRADE_RETCODE_INVALID_FILL:
                return result, next_request

        return last_result, last_request

    def _build_filling_type_candidates(self, symbol_info: Any) -> list[int]:
        filling_mode = getattr(symbol_info, "filling_mode", None)
        trade_exemode = getattr(
            symbol_info,
            "trade_exemode",
            getattr(symbol_info, "trade_execution", None),
        )

        order_fok = int(getattr(self.mt5, "ORDER_FILLING_FOK", 0))
        order_ioc = int(getattr(self.mt5, "ORDER_FILLING_IOC", 1))
        order_return = int(getattr(self.mt5, "ORDER_FILLING_RETURN", 2))
        order_boc = int(getattr(self.mt5, "ORDER_FILLING_BOC", 3))

        candidates: list[int] = []

        def add(candidate: int | None) -> None:
            if candidate is None:
                return
            if candidate not in candidates:
                candidates.append(candidate)

        execution_market = getattr(self.mt5, "SYMBOL_TRADE_EXECUTION_MARKET", None)
        if trade_exemode != execution_market:
            add(order_return)

        if isinstance(filling_mode, int):
            # MT5 symbol_info.filling_mode is exposed as allowed flags, not the request enum.
            if filling_mode & 1:
                add(order_fok)
            if filling_mode & 2:
                add(order_ioc)
            if filling_mode & 4:
                add(order_boc)

            if filling_mode in {order_fok, order_ioc, order_return, order_boc}:
                add(int(filling_mode))

        add(order_ioc)
        add(order_fok)
        if trade_exemode != execution_market:
            add(order_return)

        return candidates

    def _is_successful_trade_result(self, result: Any) -> bool:
        if result is None:
            return False

        retcode = int(getattr(result, "retcode", 0) or 0)
        return retcode in {
            int(getattr(self.mt5, "TRADE_RETCODE_DONE", 10009)),
            int(getattr(self.mt5, "TRADE_RETCODE_DONE_PARTIAL", 10010)),
            int(getattr(self.mt5, "TRADE_RETCODE_PLACED", 10008)),
        }

    def _trade_result_error(self, action: str, result: Any) -> str:
        if result is None:
            return f"{action} failed: no MT5 result returned ({self._last_error_text()})"

        retcode = getattr(result, "retcode", None)
        comment = str(getattr(result, "comment", "") or "").strip()
        suffix = f" - {comment}" if comment else ""
        return f"{action} failed: retcode={retcode}{suffix}"

    def _last_error_text(self) -> str:
        try:
            last_error = self.mt5.last_error()
        except Exception:  # noqa: BLE001
            return "unknown"

        if isinstance(last_error, tuple) and len(last_error) >= 2:
            return f"{last_error[0]}:{last_error[1]}"
        return str(last_error)

    def _calculate_slippage_pips(
        self,
        *,
        symbol: str,
        expected_price: float,
        executed_price: float,
        symbol_info: Any,
    ) -> float | None:
        if expected_price <= 0 or executed_price <= 0:
            return None

        point_size = float(getattr(symbol_info, "point", 0.0) or 0.0)
        tick_size = float(
            getattr(symbol_info, "trade_tick_size", 0.0) or point_size or 0.0
        )
        digits = int(getattr(symbol_info, "digits", 0) or 0) or None
        pip_size = self._pip_size(
            symbol,
            digits=digits,
            point_size=point_size if point_size > 0 else None,
            tick_size=tick_size if tick_size > 0 else None,
        )
        if pip_size <= 0:
            return None

        return abs(executed_price - expected_price) / pip_size

    def _history_window_start(
        self,
        checkpoint_value: Any,
        *,
        now: datetime,
        lookback_days: int,
        force_full: bool,
    ) -> datetime:
        fallback = now - timedelta(days=lookback_days)
        if force_full:
            return fallback
        if not checkpoint_value:
            return fallback

        try:
            parsed = datetime.fromisoformat(str(checkpoint_value).replace("Z", "+00:00"))
        except ValueError:
            return fallback

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        else:
            parsed = parsed.astimezone(timezone.utc)

        return max(parsed - timedelta(seconds=self.history_overlap_seconds), fallback)

    def _history_window_end(self, now: datetime) -> datetime:
        if self.history_future_seconds <= 0:
            return now

        return now + timedelta(seconds=self.history_future_seconds)

    def _should_run_full_reconcile(
        self,
        checkpoint: dict[str, Any],
        *,
        now: datetime,
        runtime_state: ConnectionRuntimeState,
        bootstrap_meta: dict[str, Any],
    ) -> bool:
        gap_heal = bootstrap_meta.get("gapHeal")
        if isinstance(gap_heal, dict) and gap_heal.get("forceFullReconcile") is True:
            return True

        if not runtime_state.has_completed_initial_full_reconcile:
            return True

        last_full_reconcile = checkpoint.get("lastFullReconcileAt")
        if not last_full_reconcile:
            return True

        try:
            parsed = datetime.fromisoformat(
                str(last_full_reconcile).replace("Z", "+00:00")
            )
        except ValueError:
            return True

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        else:
            parsed = parsed.astimezone(timezone.utc)

        return (now - parsed) >= timedelta(minutes=self.full_reconcile_minutes)

    def _build_worker_meta(
        self,
        *,
        terminal_version: Any,
        history_mode: str,
    ) -> dict[str, Any]:
        meta = build_worker_runtime_meta(mode="terminal")
        meta.update(
            {
                "mt5PackageVersion": getattr(self.mt5, "__version__", None),
                "terminalVersion": terminal_version,
                "historyMode": history_mode,
                "historyOverlapSeconds": self.history_overlap_seconds,
                "historyFutureSeconds": self.history_future_seconds,
                "tickReplaySeconds": self.tick_replay_seconds,
                "fullReconcileMinutes": self.full_reconcile_minutes,
            }
        )
        return meta

    def _collect_position_history_supplements(
        self,
        *,
        position_ids: set[str],
    ) -> tuple[list[Any], list[Any]]:
        if not position_ids:
            return [], []

        supplemental_deals: list[Any] = []
        supplemental_orders: list[Any] = []

        for position_id in sorted(position_ids):
            try:
                position_deals = self.mt5.history_deals_get(position=int(position_id)) or []
            except Exception:  # noqa: BLE001
                position_deals = []

            try:
                position_orders = self.mt5.history_orders_get(position=int(position_id)) or []
            except Exception:  # noqa: BLE001
                position_orders = []

            supplemental_deals.extend(position_deals)
            supplemental_orders.extend(position_orders)

        return supplemental_deals, supplemental_orders

    def _collect_tracked_symbols(
        self,
        *,
        positions: list[Any],
        deals: list[Any],
        orders: list[Any],
        post_exit_positions: dict[str, PostExitTrackingState],
    ) -> set[str]:
        symbols: set[str] = set()

        for position in positions:
            symbol = str(getattr(position, "symbol", "") or "").strip()
            if symbol:
                symbols.add(symbol)

        for deal in deals:
            symbol = str(getattr(deal, "symbol", "") or "").strip()
            if symbol:
                symbols.add(symbol)

        for order in orders:
            symbol = str(getattr(order, "symbol", "") or "").strip()
            if symbol:
                symbols.add(symbol)

        for tracking in post_exit_positions.values():
            if tracking.symbol:
                symbols.add(tracking.symbol)

        return symbols

    def _collect_symbol_specs(
        self,
        *,
        symbols: set[str],
        now: datetime,
    ) -> list[dict[str, Any]]:
        snapshots: list[dict[str, Any]] = []

        for symbol in sorted(symbols):
            self._ensure_symbol_selected(symbol)
            symbol_info = self.mt5.symbol_info(symbol)
            if symbol_info is None:
                continue

            digits = int(getattr(symbol_info, "digits", 0) or 0)
            point_size = float(getattr(symbol_info, "point", 0.0) or 0.0)
            tick_size = float(
                getattr(symbol_info, "trade_tick_size", 0.0) or point_size or 0.0
            )
            snapshots.append(
                {
                    "symbol": symbol,
                    "canonicalSymbol": self._canonical_symbol(symbol),
                    "digits": digits or None,
                    "pointSize": point_size if point_size > 0 else None,
                    "tickSize": tick_size if tick_size > 0 else None,
                    "contractSize": float(
                        getattr(symbol_info, "trade_contract_size", 0.0) or 0.0
                    )
                    or None,
                    "pipSize": self._pip_size(
                        symbol,
                        digits=digits or None,
                        point_size=point_size if point_size > 0 else None,
                        tick_size=tick_size if tick_size > 0 else None,
                    ),
                    "spreadPoints": int(getattr(symbol_info, "spread", 0) or 0) or None,
                    "spreadFloat": bool(getattr(symbol_info, "spread_float", False)),
                    "currencyBase": (
                        str(getattr(symbol_info, "currency_base", "") or "").strip()
                        or None
                    ),
                    "currencyProfit": (
                        str(getattr(symbol_info, "currency_profit", "") or "").strip()
                        or None
                    ),
                    "currencyMargin": (
                        str(getattr(symbol_info, "currency_margin", "") or "").strip()
                        or None
                    ),
                    "path": str(getattr(symbol_info, "path", "") or "").strip() or None,
                    "snapshotTime": to_api_timestamp(now),
                    "rawPayload": snapshot_mt5_record(symbol_info),
                }
            )

        return snapshots

    def _collect_quote_symbols(
        self,
        *,
        positions: list[Any],
        post_exit_positions: dict[str, PostExitTrackingState],
    ) -> set[str]:
        symbols: set[str] = set()

        for position in positions:
            symbol = str(getattr(position, "symbol", "") or "").strip()
            if symbol:
                symbols.add(symbol)

        for tracking in post_exit_positions.values():
            if tracking.symbol:
                symbols.add(tracking.symbol)

        return symbols

    def _apply_price_snapshots_to_connection_state(
        self,
        *,
        runtime_state: ConnectionRuntimeState,
        price_snapshots: list[dict[str, Any]],
    ) -> None:
        snapshots_by_symbol = {
            str(snapshot["symbol"]).strip(): snapshot for snapshot in price_snapshots
        }

        for state in runtime_state.active_positions.values():
            snapshot = snapshots_by_symbol.get(state.symbol)
            if snapshot is None:
                continue

            self._apply_snapshot_to_state(state, snapshot)

        for state in runtime_state.post_exit_positions.values():
            snapshot = snapshots_by_symbol.get(state.symbol)
            if snapshot is None:
                continue

            self._apply_snapshot_to_state(state, snapshot)

    def _apply_snapshot_to_state(
        self,
        state: ActivePositionState | PostExitTrackingState,
        snapshot: dict[str, Any],
    ) -> None:
        bid = float(snapshot.get("bid", 0.0) or 0.0)
        ask = float(snapshot.get("ask", 0.0) or 0.0)
        timestamp_raw = snapshot.get("timestamp")

        if bid <= 0 and ask <= 0:
            return

        state.last_bid = bid if bid > 0 else state.last_bid
        state.last_ask = ask if ask > 0 else state.last_ask
        state.last_quote_time = (
            self._parse_snapshot_timestamp(str(timestamp_raw))
            if isinstance(timestamp_raw, str)
            else state.last_quote_time
        )

        if state.entry_expected_price is None:
            if state.side == "buy" and ask > 0:
                state.entry_expected_price = ask
            elif state.side == "sell" and bid > 0:
                state.entry_expected_price = bid

        if (
            state.entry_spread_pips is None
            and bid > 0
            and ask > 0
            and ask >= bid
        ):
            pip_size = self._pip_size(state.symbol)
            if pip_size > 0:
                state.entry_spread_pips = (ask - bid) / pip_size

    def _build_execution_contexts(
        self,
        runtime_state: ConnectionRuntimeState,
    ) -> list[dict[str, Any]]:
        payloads: list[dict[str, Any]] = []

        for trade_key, state in runtime_state.active_positions.items():
            payloads.append(
                {
                    "tradeKey": trade_key,
                    "positionId": trade_key,
                    "symbol": state.symbol,
                    "side": state.side,
                    "lifecycleState": "active",
                    "entryExpectedPrice": state.entry_expected_price,
                    "entrySpreadPips": state.entry_spread_pips,
                    "lastBid": state.last_bid,
                    "lastAsk": state.last_ask,
                    "lastQuoteTime": (
                        to_api_timestamp(state.last_quote_time)
                        if state.last_quote_time
                        else None
                    ),
                }
            )

        for trade_key, state in runtime_state.post_exit_positions.items():
            payloads.append(
                {
                    "tradeKey": trade_key,
                    "positionId": trade_key,
                    "symbol": state.symbol,
                    "side": state.side,
                    "lifecycleState": "post_exit",
                    "entryExpectedPrice": state.entry_expected_price,
                    "entrySpreadPips": state.entry_spread_pips,
                    "lastBid": state.last_bid,
                    "lastAsk": state.last_ask,
                    "lastQuoteTime": (
                        to_api_timestamp(state.last_quote_time)
                        if state.last_quote_time
                        else None
                    ),
                    "exitReferenceBid": state.exit_reference_bid,
                    "exitReferenceAsk": state.exit_reference_ask,
                    "exitReferenceTime": (
                        to_api_timestamp(state.exit_reference_time)
                        if state.exit_reference_time
                        else None
                    ),
                    "closeTime": to_api_timestamp(state.close_time),
                }
            )

        return payloads

    def _filter_ledger_deals(self, deals: list[Any]) -> list[Any]:
        ledger_deals: list[Any] = []
        for deal in deals:
            ticket = str(getattr(deal, "ticket", "") or "").strip()
            symbol = str(getattr(deal, "symbol", "") or "").strip()
            if ticket and not symbol:
                ledger_deals.append(deal)

        return ledger_deals

    def _map_ledger_type(self, deal: Any) -> str:
        raw_type = str(getattr(deal, "type", "") or "").strip()
        if raw_type:
            return raw_type
        return "ledger"

    def _collect_position_ids_for_supplementation(
        self,
        *,
        positions: list[Any],
        deals: list[Any],
        orders: list[Any],
        full_reconcile: bool,
    ) -> set[str]:
        position_ids: set[str] = set()
        latest_deal_ms_by_position: dict[str, int] = {}
        order_ids_with_deals: set[str] = set()

        for deal in deals:
            position_id = str(getattr(deal, "position_id", "") or "").strip()
            remote_order_id = str(getattr(deal, "order", "") or "").strip()
            if remote_order_id:
                order_ids_with_deals.add(remote_order_id)
            if not position_id:
                continue

            position_ids.add(position_id)
            latest_deal_ms_by_position[position_id] = max(
                latest_deal_ms_by_position.get(position_id, 0),
                self._sort_timestamp_ms(
                    getattr(deal, "time_msc", None),
                    getattr(deal, "time", 0),
                ),
            )

        candidate_position_ids: set[str] = set()

        for position in positions:
            position_id = str(getattr(position, "ticket", "") or "").strip()
            if not position_id:
                continue
            if full_reconcile or position_id not in position_ids:
                candidate_position_ids.add(position_id)

        for order in orders:
            position_id = str(getattr(order, "position_id", "") or "").strip()
            remote_order_id = str(getattr(order, "ticket", "") or "").strip()
            if not position_id:
                continue

            order_ts = self._sort_timestamp_ms(
                getattr(order, "time_done_msc", None)
                or getattr(order, "time_setup_msc", None),
                getattr(order, "time_done", None) or getattr(order, "time_setup", 0),
            )
            latest_deal_ts = latest_deal_ms_by_position.get(position_id, 0)
            has_direct_deal_match = bool(remote_order_id and remote_order_id in order_ids_with_deals)

            if (
                full_reconcile
                or position_id not in position_ids
                or not has_direct_deal_match
                or order_ts > latest_deal_ts
            ):
                candidate_position_ids.add(position_id)

        return candidate_position_ids

    def _merge_unique_deals(self, primary: list[Any], supplemental: list[Any]) -> list[Any]:
        merged: dict[str, Any] = {}

        for deal in [*primary, *supplemental]:
            ticket = str(getattr(deal, "ticket", "") or "").strip()
            if not ticket:
                continue

            existing = merged.get(ticket)
            if existing is None:
                merged[ticket] = deal
                continue

            current_ts = self._sort_timestamp_ms(
                getattr(deal, "time_msc", None),
                getattr(deal, "time", 0),
            )
            existing_ts = self._sort_timestamp_ms(
                getattr(existing, "time_msc", None),
                getattr(existing, "time", 0),
            )
            if current_ts >= existing_ts:
                merged[ticket] = deal

        return list(merged.values())

    def _merge_unique_orders(self, primary: list[Any], supplemental: list[Any]) -> list[Any]:
        merged: dict[str, Any] = {}

        for order in [*primary, *supplemental]:
            event_key = self._order_event_key(order)
            if not event_key:
                continue

            existing = merged.get(event_key)
            if existing is None:
                merged[event_key] = order
                continue

            current_ts = self._sort_timestamp_ms(
                getattr(order, "time_done_msc", None)
                or getattr(order, "time_setup_msc", None),
                getattr(order, "time_done", None) or getattr(order, "time_setup", 0),
            )
            existing_ts = self._sort_timestamp_ms(
                getattr(existing, "time_done_msc", None)
                or getattr(existing, "time_setup_msc", None),
                getattr(existing, "time_done", None)
                or getattr(existing, "time_setup", 0),
            )
            if current_ts >= existing_ts:
                merged[event_key] = order

        return list(merged.values())

    def _order_event_key(self, order: Any) -> str:
        ticket = str(getattr(order, "ticket", "") or "").strip()
        if not ticket:
            return ""

        state = str(getattr(order, "state", "") or "").strip()
        time_setup = str(getattr(order, "time_setup", "") or "").strip()
        return f"{ticket}:{state}:{time_setup}"

    def _filter_trade_deals(self, deals: list[Any]) -> list[Any]:
        filtered: list[Any] = []
        for deal in deals:
            ticket = str(getattr(deal, "ticket", "") or "").strip()
            symbol = str(getattr(deal, "symbol", "") or "").strip()

            # MT5 history includes non-position records such as balance/credit adjustments.
            # Those have no tradable symbol and should not be sent through the trade-normalized API.
            if not ticket or not symbol:
                continue

            filtered.append(deal)

        return filtered

    def _pip_size(
        self,
        symbol: str,
        *,
        digits: int | None = None,
        point_size: float | None = None,
        tick_size: float | None = None,
    ) -> float:
        canonical = self._canonical_symbol(symbol)
        if "JPY" in canonical:
            return 0.01
        if canonical.startswith("XAU") or canonical.startswith("XAG"):
            if point_size is not None and point_size >= 0.01:
                return point_size
            if tick_size is not None and tick_size >= 0.01:
                return tick_size
            return 0.01
        if len(canonical) == 6 and canonical.isalpha():
            if digits in {3, 5}:
                if point_size is not None and point_size > 0:
                    return point_size * 10
                if tick_size is not None and tick_size > 0:
                    return tick_size * 10
            if digits in {2, 4}:
                if point_size is not None and point_size > 0:
                    return point_size
                if tick_size is not None and tick_size > 0:
                    return tick_size
            return 0.0001
        if point_size is not None and point_size > 0:
            return point_size
        if tick_size is not None and tick_size > 0:
            return tick_size
        return 0.0001

    def _get_connection_state(self, connection_id: str) -> ConnectionRuntimeState:
        existing = self.connection_states.get(connection_id)
        if existing is None:
            existing = ConnectionRuntimeState()
            self.connection_states[connection_id] = existing
        return existing

    def _update_connection_state(
        self,
        connection_id: str,
        *,
        positions: list[Any],
        deals: list[Any],
        now: datetime,
    ) -> ConnectionRuntimeState:
        state = self._get_connection_state(connection_id)
        current_positions: dict[str, ActivePositionState] = {}

        for position in positions:
            trade_key = str(getattr(position, "ticket", "") or "").strip()
            symbol = str(getattr(position, "symbol", "") or "").strip()
            side = SIDE_MAP.get(int(getattr(position, "type", 0)), "buy")

            if not trade_key or not symbol:
                continue

            previous = state.active_positions.get(trade_key)
            if previous is not None:
                current_positions[trade_key] = ActivePositionState(
                    trade_key=trade_key,
                    symbol=symbol,
                    side=side,
                    entry_expected_price=previous.entry_expected_price,
                    entry_spread_pips=previous.entry_spread_pips,
                    last_bid=previous.last_bid,
                    last_ask=previous.last_ask,
                    last_quote_time=previous.last_quote_time,
                )
            else:
                current_positions[trade_key] = ActivePositionState(
                    trade_key=trade_key,
                    symbol=symbol,
                    side=side,
                )

        latest_exit_deals: dict[str, Any] = {}
        for deal in deals:
            trade_key = str(getattr(deal, "position_id", "") or "").strip()
            if not trade_key:
                continue

            entry_type = ENTRY_MAP.get(int(getattr(deal, "entry", 0)), "in")
            if entry_type not in {"out", "out_by", "inout"}:
                continue

            existing = latest_exit_deals.get(trade_key)
            if existing is None:
                latest_exit_deals[trade_key] = deal
                continue

            current_ts = self._sort_timestamp_ms(
                getattr(deal, "time_msc", None),
                getattr(deal, "time", 0),
            )
            existing_ts = self._sort_timestamp_ms(
                getattr(existing, "time_msc", None),
                getattr(existing, "time", 0),
            )
            if current_ts >= existing_ts:
                latest_exit_deals[trade_key] = deal

        if self.post_exit_tracking_seconds <= 0:
            state.post_exit_positions.clear()
        else:
            for trade_key, previous in state.active_positions.items():
                if trade_key in current_positions or trade_key in state.post_exit_positions:
                    continue

                exit_deal = latest_exit_deals.get(trade_key)
                close_time = self._deal_time(exit_deal) if exit_deal is not None else now
                state.post_exit_positions[trade_key] = PostExitTrackingState(
                    trade_key=trade_key,
                    symbol=previous.symbol,
                    side=previous.side,
                    close_time=close_time,
                    tracking_end_time=close_time
                    + timedelta(seconds=self.post_exit_tracking_seconds),
                    entry_expected_price=previous.entry_expected_price,
                    entry_spread_pips=previous.entry_spread_pips,
                    last_bid=previous.last_bid,
                    last_ask=previous.last_ask,
                    last_quote_time=previous.last_quote_time,
                    exit_reference_bid=previous.last_bid,
                    exit_reference_ask=previous.last_ask,
                    exit_reference_time=previous.last_quote_time,
                )

        for trade_key in list(state.post_exit_positions.keys()):
            track = state.post_exit_positions[trade_key]
            if trade_key in current_positions or now > track.tracking_end_time:
                state.post_exit_positions.pop(trade_key, None)

        state.active_positions = current_positions
        return state

    def _collect_price_snapshots(
        self,
        *,
        runtime_state: ConnectionRuntimeState,
        tracked_symbols: set[str],
        now: datetime,
    ) -> list[dict[str, Any]]:
        snapshots: list[dict[str, Any]] = []
        for symbol in list(runtime_state.last_tick_sent_at_by_symbol.keys()):
            if symbol not in tracked_symbols:
                runtime_state.last_tick_sent_at_by_symbol.pop(symbol, None)

        for symbol in sorted(tracked_symbols):
            symbol_snapshots = self._replay_symbol_ticks(
                runtime_state=runtime_state,
                symbol=symbol,
                now=now,
            )
            if not symbol_snapshots:
                latest_snapshot = self._snapshot_from_latest_tick(symbol)
                if latest_snapshot is not None:
                    last_sent = runtime_state.last_tick_sent_at_by_symbol.get(symbol)
                    latest_time = self._parse_snapshot_timestamp(
                        latest_snapshot["timestamp"]
                    )
                    if last_sent is None or latest_time > last_sent:
                        symbol_snapshots = [latest_snapshot]

            if not symbol_snapshots:
                continue

            runtime_state.last_tick_sent_at_by_symbol[symbol] = (
                self._parse_snapshot_timestamp(symbol_snapshots[-1]["timestamp"])
            )
            snapshots.extend(symbol_snapshots)

        return snapshots

    def _replay_symbol_ticks(
        self,
        *,
        runtime_state: ConnectionRuntimeState,
        symbol: str,
        now: datetime,
    ) -> list[dict[str, Any]]:
        self._ensure_symbol_selected(symbol)

        last_sent = runtime_state.last_tick_sent_at_by_symbol.get(symbol)
        range_start = (
            last_sent + timedelta(milliseconds=1)
            if last_sent is not None
            else now - timedelta(seconds=self.tick_replay_seconds)
        )
        if range_start >= now:
            return []

        flags = getattr(
            self.mt5,
            "COPY_TICKS_INFO",
            getattr(self.mt5, "COPY_TICKS_ALL", 0),
        )

        try:
            ticks = self.mt5.copy_ticks_range(symbol, range_start, now, flags)
        except Exception:  # noqa: BLE001
            return []

        if ticks is None:
            return []

        deduped: dict[str, dict[str, Any]] = {}
        for tick in ticks:
            snapshot = self._snapshot_from_tick_record(symbol, tick)
            if snapshot is None:
                continue

            snapshot_time = self._parse_snapshot_timestamp(snapshot["timestamp"])
            if last_sent is not None and snapshot_time <= last_sent:
                continue
            deduped[snapshot["timestamp"]] = snapshot

        return [deduped[key] for key in sorted(deduped.keys())]

    def _snapshot_from_latest_tick(self, symbol: str) -> dict[str, Any] | None:
        self._ensure_symbol_selected(symbol)
        tick = self.mt5.symbol_info_tick(symbol)
        if tick is None:
            return None

        return self._snapshot_from_tick_record(symbol, tick)

    def _snapshot_from_tick_record(
        self,
        symbol: str,
        tick: Any,
    ) -> dict[str, Any] | None:
        bid = float(self._tick_field(tick, "bid") or 0.0)
        ask = float(self._tick_field(tick, "ask") or 0.0)
        if bid <= 0 and ask <= 0:
            return None

        timestamp = self._timestamp_to_datetime(
            self._tick_field(tick, "time_msc"),
            self._tick_field(tick, "time"),
        )
        volume = float(
            self._tick_field(tick, "volume_real")
            or self._tick_field(tick, "volume")
            or 0.0
        )

        return {
            "symbol": symbol,
            "bid": bid,
            "ask": ask,
            "timestamp": to_api_timestamp(timestamp),
            "bidVolume": volume,
            "askVolume": volume,
        }

    def _tick_field(self, tick: Any, key: str) -> Any:
        try:
            value = tick[key]
            if value is not None:
                return value
        except Exception:  # noqa: BLE001
            pass

        return getattr(tick, key, None)

    def _ensure_symbol_selected(self, symbol: str) -> None:
        try:
            self.mt5.symbol_select(symbol, True)
        except Exception:  # noqa: BLE001
            return

    def _parse_snapshot_timestamp(self, value: str) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    def _canonical_symbol(self, symbol: str) -> str:
        upper = symbol.strip().upper()
        alphanumeric = "".join(char for char in upper if char.isalnum())
        for index in range(max(0, len(alphanumeric) - 5)):
            candidate = alphanumeric[index:index + 6]
            if len(candidate) == 6 and candidate.isalpha():
                return candidate
        return upper

    def _position_time(self, position: Any) -> datetime:
        return self._timestamp_to_datetime(
            getattr(position, "time_msc", None),
            getattr(position, "time", 0),
        )

    def _deal_time(self, deal: Any) -> datetime:
        return self._timestamp_to_datetime(
            getattr(deal, "time_msc", None),
            getattr(deal, "time", 0),
        )

    def _order_time(self, order: Any) -> datetime:
        return self._timestamp_to_datetime(
            getattr(order, "time_setup_msc", None),
            getattr(order, "time_setup", 0),
        )

    def _timestamp_to_datetime(
        self,
        raw_millis: Any,
        raw_seconds: Any,
    ) -> datetime:
        millis = self._sort_timestamp_ms(raw_millis, raw_seconds)
        return datetime.fromtimestamp(millis / 1000, tz=timezone.utc)

    def _sort_timestamp_ms(self, raw_millis: Any, raw_seconds: Any) -> int:
        try:
            millis = int(raw_millis)
        except (TypeError, ValueError):
            millis = 0

        if millis > 0:
            return millis

        try:
            seconds = int(raw_seconds)
        except (TypeError, ValueError):
            seconds = 0

        if seconds > 0:
            return seconds * 1000

        return int(datetime.now(timezone.utc).timestamp() * 1000)

    def _initialize_terminal(
        self,
        session: TerminalSession,
        *,
        login: int,
        password: str,
        server: str,
    ) -> None:
        if self._can_reuse_initialized_terminal(
            session=session,
            login=login,
            server=server,
        ):
            if session.initialized_at is None:
                session.initialized_at = datetime.now(timezone.utc)
            return

        if self.active_connection_id and self.active_connection_id != session.connection_id:
            self._reset_terminal_session()

        first_error: tuple[Any, ...] | None = None

        for attempt in range(2):
            initialized = self.mt5.initialize(
                path=str(session.executable_path),
                login=login,
                password=password,
                server=server,
                timeout=self.initialize_timeout_ms,
                portable=True,
            )

            if initialized:
                try:
                    self._wait_for_connected_terminal(
                        session=session,
                        login=login,
                        server=server,
                    )
                except Exception as error:  # noqa: BLE001
                    if attempt == 0:
                        first_error = ("connected_check", str(error))
                        self._reset_terminal_session()
                        self.session_manager.rebuild_installation(session)
                        time.sleep(1)
                        continue
                    second_error = ("connected_check", str(error))
                    raise RuntimeError(
                        "MetaTrader5 initialize failed after launch because terminal "
                        "did not become broker-connected "
                        f"(first={first_error}, second={second_error}, "
                        f"server={server}, template={session.template_executable_path}, "
                        f"templateResolution={session.template_resolution}, "
                        f"terminal={session.executable_path})"
                    ) from error

                self.session_manager.mark_login(session)
                self.active_connection_id = session.connection_id
                self.active_terminal_path = str(session.executable_path)
                self.active_login = login
                self.active_server = server
                return

            if attempt == 0:
                first_error = self.mt5.last_error()
                self._reset_terminal_session()

                self.session_manager.rebuild_installation(session)
                time.sleep(1)

        second_error = self.mt5.last_error()
        raise RuntimeError(
            "MetaTrader5 initialize failed "
            f"(first={first_error}, second={second_error}, server={server}, "
            f"template={session.template_executable_path}, "
            f"templateResolution={session.template_resolution}, "
            f"terminal={session.executable_path})"
        )

    def _wait_for_connected_terminal(
        self,
        *,
        session: TerminalSession,
        login: int,
        server: str,
    ) -> None:
        deadline = time.time() + self.connected_timeout_seconds
        last_terminal_info: Any = None
        last_account_info: Any = None

        while time.time() < deadline:
            try:
                last_terminal_info = self.mt5.terminal_info()
                last_account_info = self.mt5.account_info()
            except Exception:  # noqa: BLE001
                last_terminal_info = None
                last_account_info = None

            connected = bool(
                last_terminal_info is not None
                and getattr(last_terminal_info, "connected", False)
            )
            current_login = int(getattr(last_account_info, "login", 0) or 0)
            current_server = str(getattr(last_account_info, "server", "") or "")

            if connected and current_login == login and current_server == server:
                return

            time.sleep(1)

        last_error = self.mt5.last_error()
        raise RuntimeError(
            "terminal never reached a connected broker session "
            f"(lastError={last_error}, connected={getattr(last_terminal_info, 'connected', None)}, "
            f"currentLogin={getattr(last_account_info, 'login', None)}, "
            f"currentServer={getattr(last_account_info, 'server', None)}, "
            f"requestedLogin={login}, requestedServer={server}, "
            f"template={session.template_executable_path}, "
            f"templateResolution={session.template_resolution}). "
            "This usually means the selected MT5 installation does not have this broker "
            "server available. Use the broker-branded terminal build or map this server "
            "to a matching MT5 install via MT5_TERMINAL_PATH_MAP."
        )

    def _can_reuse_initialized_terminal(
        self,
        *,
        session: TerminalSession,
        login: int,
        server: str,
    ) -> bool:
        if self.active_connection_id != session.connection_id:
            return False
        if self.active_terminal_path != str(session.executable_path):
            return False
        if self.active_login != login or self.active_server != server:
            return False

        try:
            terminal_info = self.mt5.terminal_info()
            account_info = self.mt5.account_info()
        except Exception:  # noqa: BLE001
            return False

        if terminal_info is None or account_info is None:
            return False
        if getattr(terminal_info, "connected", True) is False:
            return False

        current_login = int(getattr(account_info, "login", 0) or 0)
        current_server = str(getattr(account_info, "server", "") or "")
        return current_login == login and current_server == server

    def _reset_terminal_session(self) -> None:
        try:
            self.mt5.shutdown()
        except Exception:  # noqa: BLE001
            pass

        self.active_connection_id = None
        self.active_terminal_path = None
        self.active_login = None
        self.active_server = None

    def release_connection(self, connection_id: str) -> None:
        if self.active_connection_id == connection_id:
            self._reset_terminal_session()

    def close(self) -> None:
        self._reset_terminal_session()
