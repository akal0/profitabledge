from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from runtime import build_worker_runtime_meta, serialize_for_json, to_api_timestamp

from .base import MtAdapter


@dataclass
class RithmicContractSpec:
    symbol: str
    exchange: str | None
    tick_size: float | None
    tick_value: float | None
    multiplier: float | None
    raw: dict[str, Any]


@dataclass
class RithmicFillRecord:
    remote_order_id: str
    account_id: str
    symbol: str
    exchange: str | None
    side: str
    volume: float
    price: float
    event_time: datetime
    comment: str | None
    commission: float | None
    fee: float | None
    raw: dict[str, Any]


@dataclass
class OpenPositionState:
    position_id: str
    symbol: str
    exchange: str | None
    side: str
    open_time: datetime
    remaining_volume: float
    open_notional: float

    @property
    def average_open_price(self) -> float | None:
        if self.remaining_volume <= 0:
            return None
        return self.open_notional / self.remaining_volume


class RithmicAdapter(MtAdapter):
    def __init__(
        self,
        *,
        gateway_url: str | None,
        app_name: str | None,
        app_version: str | None,
    ) -> None:
        self.gateway_url = gateway_url
        self.app_name = app_name or "Profitabledge"
        self.app_version = app_version or "0.1.0"

        try:
            from async_rithmic import RithmicClient, SysInfraType  # type: ignore
        except ImportError as error:
            raise RuntimeError(
                "async_rithmic is required for Rithmic worker mode. "
                "Install it on the worker host before enabling Rithmic."
            ) from error

        self._client_cls = RithmicClient
        self._sys_infra_type = SysInfraType

    def collect_frame(self, bootstrap: dict[str, Any], lookback_days: int) -> dict[str, Any]:
        return asyncio.run(self._collect_frame_async(bootstrap, lookback_days))

    async def _collect_frame_async(
        self, bootstrap: dict[str, Any], lookback_days: int
    ) -> dict[str, Any]:
        credentials = bootstrap["credentials"]
        meta = bootstrap.get("meta") or {}
        login = str(credentials.get("login", "")).strip()
        password = str(credentials.get("password", "")).strip()
        system_name = str(credentials.get("systemName", "")).strip()
        fcm_id = str(credentials.get("fcmId", "")).strip()
        ib_id = str(credentials.get("ibId", "")).strip() or None
        gateway_url = (
            str(credentials.get("gatewayUrl", "")).strip()
            or str(meta.get("gatewayUrl", "")).strip()
            or self.gateway_url
        )

        if not login or not password or not system_name or not fcm_id or not gateway_url:
            raise RuntimeError(
                "Rithmic worker connections require login, password, systemName, fcmId, and gateway URL."
            )

        snapshot_time = datetime.now(timezone.utc)
        client = self._client_cls(
            user=login,
            password=password,
            system_name=system_name,
            app_name=self.app_name,
            app_version=self.app_version,
            url=gateway_url,
        )

        try:
            await client.connect(
                plants=[
                    self._sys_infra_type.ORDER_PLANT,
                    self._sys_infra_type.PNL_PLANT,
                ]
            )

            order_plant = client.plants["order"]
            pnl_plant = client.plants["pnl"]

            account_rows = await order_plant.list_accounts()
            account_dicts = [
                self._to_payload_dict(order_plant, row) for row in account_rows
            ]
            discovered_accounts = self._build_discovered_accounts(account_dicts)
            selected_account_id = self._resolve_account_id(
                credentials=credentials,
                meta=meta,
                account_rows=account_dicts,
            )

            account_summary_rows = await pnl_plant.list_account_summary(
                account_id=selected_account_id
            )
            position_rows = await pnl_plant.list_positions(account_id=selected_account_id)
            history_rows = await self._collect_order_history(
                order_plant=order_plant,
                account_id=selected_account_id,
                sync_cursor=bootstrap.get("syncCursor"),
                lookback_days=lookback_days,
            )

            account_summary_dicts = [
                self._to_payload_dict(pnl_plant, row) for row in account_summary_rows
            ]
            position_dicts = [
                self._to_payload_dict(pnl_plant, row) for row in position_rows
            ]
            contract_specs = await self._load_contract_specs(
                order_plant=order_plant,
                history_rows=history_rows,
                position_rows=position_dicts,
            )
            deals, open_states = self._build_synthetic_deals(
                history_rows=history_rows,
                contract_specs=contract_specs,
            )
            orders = self._build_order_history_rows(history_rows)
            positions = self._build_position_snapshots(
                position_rows=position_dicts,
                open_states=open_states,
                contract_specs=contract_specs,
                snapshot_time=snapshot_time,
            )
            symbol_specs = self._build_symbol_specs(
                contract_specs=contract_specs,
                snapshot_time=snapshot_time,
            )

            return {
                "connectionId": bootstrap["connectionId"],
                "session": {
                    "status": "syncing",
                    "heartbeatAt": to_api_timestamp(snapshot_time),
                    "meta": {
                        **build_worker_runtime_meta(mode="rithmic"),
                        "workerProvider": "rithmic",
                        "gatewayUrl": gateway_url,
                        "systemName": system_name,
                        "fcmId": fcm_id,
                        "ibId": ib_id,
                        "discoveredAccounts": discovered_accounts,
                        "selectedAccountId": selected_account_id,
                        "historyOrderCount": len(history_rows),
                        "historyDealCount": len(deals),
                    },
                },
                "account": self._map_account_snapshot(
                    account_id=selected_account_id,
                    system_name=system_name,
                    gateway_url=gateway_url,
                    snapshot_time=snapshot_time,
                    account_summary_rows=account_summary_dicts,
                    account_rows=account_dicts,
                ),
                "positions": positions,
                "deals": deals,
                "orders": orders,
                "ledgerEvents": [],
                "executionContexts": [],
                "symbolSpecs": symbol_specs,
                "priceSnapshots": [],
            }
        finally:
            try:
                await client.disconnect()
            except Exception:
                pass

    async def _collect_order_history(
        self,
        *,
        order_plant: Any,
        account_id: str,
        sync_cursor: str | None,
        lookback_days: int,
    ) -> list[dict[str, Any]]:
        try:
            date_rows = await order_plant.show_order_history_dates()
        except Exception:
            return []

        date_strings = [
            self._to_payload_dict(order_plant, row).get("date") for row in date_rows
        ]
        date_strings = [str(value) for value in date_strings if value]
        if not date_strings:
            return []

        if sync_cursor:
            try:
                start_date = datetime.fromisoformat(str(sync_cursor).replace("Z", "+00:00"))
            except ValueError:
                start_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        else:
            start_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)

        recent_dates = [
            value
            for value in sorted(date_strings)
            if self._parse_history_date(value) >= start_date.date()
        ]
        recent_dates = recent_dates[-10:]

        history_rows: list[dict[str, Any]] = []
        for value in recent_dates:
            try:
                rows = await order_plant.show_order_history_summary(
                    value,
                    account_id=account_id,
                )
            except Exception:
                continue

            history_rows.extend(self._to_payload_dict(order_plant, row) for row in rows)

        return history_rows

    async def _load_contract_specs(
        self,
        *,
        order_plant: Any,
        history_rows: list[dict[str, Any]],
        position_rows: list[dict[str, Any]],
    ) -> dict[tuple[str, str | None], RithmicContractSpec]:
        instrument_pairs: set[tuple[str, str | None]] = set()
        for row in history_rows + position_rows:
            symbol = row.get("symbol")
            if not symbol:
                continue
            instrument_pairs.add((str(symbol), self._normalize_exchange(row.get("exchange"))))

        specs: dict[tuple[str, str | None], RithmicContractSpec] = {}
        for symbol, exchange in instrument_pairs:
            if not exchange:
                specs[(symbol, exchange)] = RithmicContractSpec(
                    symbol=symbol,
                    exchange=exchange,
                    tick_size=None,
                    tick_value=None,
                    multiplier=None,
                    raw={},
                )
                continue

            try:
                response = await order_plant.get_reference_data(symbol=symbol, exchange=exchange)
                payload = self._to_payload_dict(order_plant, response)
            except Exception:
                payload = {}

            specs[(symbol, exchange)] = RithmicContractSpec(
                symbol=symbol,
                exchange=exchange,
                tick_size=self._to_float(
                    payload.get("tick_multiplier") or payload.get("tick_size")
                ),
                tick_value=self._to_float(payload.get("tick_value")),
                multiplier=self._to_float(payload.get("multiplier")),
                raw=payload,
            )

        return specs

    def _build_discovered_accounts(
        self, account_rows: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        discovered = []
        for row in account_rows:
            provider_account_id = str(
                row.get("account_id") or row.get("accountId") or ""
            ).strip()
            if not provider_account_id:
                continue

            discovered.append(
                {
                    "providerAccountId": provider_account_id,
                    "accountNumber": provider_account_id,
                    "label": str(
                        row.get("account_name")
                        or row.get("accountName")
                        or provider_account_id
                    ),
                    "brokerName": "Rithmic",
                    "currency": str(row.get("account_currency") or "USD"),
                    "environment": "unknown",
                    "metadata": row,
                }
            )

        return discovered

    def _build_synthetic_deals(
        self,
        *,
        history_rows: list[dict[str, Any]],
        contract_specs: dict[tuple[str, str | None], RithmicContractSpec],
    ) -> tuple[list[dict[str, Any]], dict[tuple[str, str, str | None], OpenPositionState]]:
        fill_rows = [
            fill
            for fill in (
                self._history_row_to_fill(row) for row in history_rows
            )
            if fill is not None
        ]
        fill_rows.sort(
            key=lambda fill: (
                fill.event_time,
                fill.remote_order_id,
                fill.side,
            )
        )

        deals: list[dict[str, Any]] = []
        open_states: dict[tuple[str, str, str | None], OpenPositionState] = {}
        emitted_keys: set[str] = set()
        synthetic_position_index = 0
        synthetic_deal_index = 0

        for fill in fill_rows:
            instrument_key = (
                fill.account_id,
                fill.symbol,
                fill.exchange,
            )
            state = open_states.get(instrument_key)
            remaining = fill.volume

            while remaining > 0:
                if state is None:
                    synthetic_position_index += 1
                    position_id = (
                        f"rithmic:{fill.account_id}:{fill.symbol}:{synthetic_position_index}"
                    )
                    synthetic_deal_index += 1
                    deal = self._build_deal_event(
                        fill=fill,
                        deal_suffix=f"entry-{synthetic_deal_index}",
                        position_id=position_id,
                        entry_type="in",
                        volume=remaining,
                        profit=None,
                    )
                    if deal["remoteDealId"] not in emitted_keys:
                        emitted_keys.add(deal["remoteDealId"])
                        deals.append(deal)
                    state = OpenPositionState(
                        position_id=position_id,
                        symbol=fill.symbol,
                        exchange=fill.exchange,
                        side=fill.side,
                        open_time=fill.event_time,
                        remaining_volume=remaining,
                        open_notional=fill.price * remaining,
                    )
                    open_states[instrument_key] = state
                    remaining = 0
                    continue

                if fill.side == state.side:
                    synthetic_deal_index += 1
                    deal = self._build_deal_event(
                        fill=fill,
                        deal_suffix=f"scale-{synthetic_deal_index}",
                        position_id=state.position_id,
                        entry_type="in",
                        volume=remaining,
                        profit=None,
                    )
                    if deal["remoteDealId"] not in emitted_keys:
                        emitted_keys.add(deal["remoteDealId"])
                        deals.append(deal)
                    state.open_notional += fill.price * remaining
                    state.remaining_volume += remaining
                    remaining = 0
                    continue

                matched_volume = min(state.remaining_volume, remaining)
                average_open_price = state.average_open_price or fill.price
                contract_spec = contract_specs.get(
                    (fill.symbol, fill.exchange),
                    RithmicContractSpec(
                        symbol=fill.symbol,
                        exchange=fill.exchange,
                        tick_size=None,
                        tick_value=None,
                        multiplier=None,
                        raw={},
                    ),
                )
                profit = self._calculate_realized_profit(
                    side=state.side,
                    open_price=average_open_price,
                    close_price=fill.price,
                    volume=matched_volume,
                    contract_spec=contract_spec,
                )
                synthetic_deal_index += 1
                exit_deal = self._build_deal_event(
                    fill=fill,
                    deal_suffix=f"exit-{synthetic_deal_index}",
                    position_id=state.position_id,
                    entry_type="out",
                    volume=matched_volume,
                    profit=profit,
                )
                if exit_deal["remoteDealId"] not in emitted_keys:
                    emitted_keys.add(exit_deal["remoteDealId"])
                    deals.append(exit_deal)

                state.open_notional -= average_open_price * matched_volume
                state.remaining_volume -= matched_volume
                remaining -= matched_volume

                if state.remaining_volume <= 1e-9:
                    open_states.pop(instrument_key, None)
                    state = None
                else:
                    open_states[instrument_key] = state

        deals.sort(key=lambda row: (row["eventTime"], row["remoteDealId"]))
        return deals, open_states

    def _build_position_snapshots(
        self,
        *,
        position_rows: list[dict[str, Any]],
        open_states: dict[tuple[str, str, str | None], OpenPositionState],
        contract_specs: dict[tuple[str, str | None], RithmicContractSpec],
        snapshot_time: datetime,
    ) -> list[dict[str, Any]]:
        snapshots: list[dict[str, Any]] = []
        for row in position_rows:
            net_quantity = int(self._to_float(row.get("net_quantity")) or 0)
            if net_quantity == 0:
                continue

            symbol = row.get("symbol")
            if not symbol:
                continue

            exchange = self._normalize_exchange(row.get("exchange"))
            instrument_key = (str(row.get("account_id")), str(symbol), exchange)
            open_state = open_states.get(instrument_key)
            side = "buy" if net_quantity > 0 else "sell"
            average_open_price = self._to_float(row.get("avg_open_fill_price"))
            if open_state is not None and open_state.side == side:
                average_open_price = open_state.average_open_price or average_open_price
                open_time = open_state.open_time
                remote_position_id = open_state.position_id
            else:
                open_time = snapshot_time
                remote_position_id = f"{row.get('account_id')}:{symbol}"

            if average_open_price is None:
                continue

            contract_spec = contract_specs.get((str(symbol), exchange))

            snapshots.append(
                {
                    "remotePositionId": remote_position_id,
                    "side": side,
                    "symbol": str(symbol),
                    "volume": abs(net_quantity),
                    "openPrice": average_open_price,
                    "currentPrice": None,
                    "profit": self._to_float(
                        row.get("open_position_pnl") or row.get("day_open_pnl")
                    ),
                    "swap": None,
                    "commission": self._to_float(row.get("rms_account_commission")),
                    "sl": None,
                    "tp": None,
                    "comment": None,
                    "magicNumber": None,
                    "openTime": to_api_timestamp(open_time),
                    "snapshotTime": to_api_timestamp(snapshot_time),
                    "rawPayload": {
                        **row,
                        "contractSpec": contract_spec.raw if contract_spec else None,
                    },
                }
            )

        return snapshots

    def _build_symbol_specs(
        self,
        *,
        contract_specs: dict[tuple[str, str | None], RithmicContractSpec],
        snapshot_time: datetime,
    ) -> list[dict[str, Any]]:
        specs: list[dict[str, Any]] = []
        for contract_spec in contract_specs.values():
            specs.append(
                {
                    "symbol": contract_spec.symbol,
                    "canonicalSymbol": contract_spec.symbol,
                    "digits": None,
                    "pointSize": contract_spec.tick_size,
                    "tickSize": contract_spec.tick_size,
                    "contractSize": contract_spec.multiplier,
                    "pipSize": contract_spec.tick_size,
                    "spreadPoints": None,
                    "spreadFloat": None,
                    "currencyBase": None,
                    "currencyProfit": None,
                    "currencyMargin": None,
                    "path": contract_spec.exchange,
                    "snapshotTime": to_api_timestamp(snapshot_time),
                    "rawPayload": contract_spec.raw,
                }
            )

        return specs

    def _build_order_history_rows(
        self, history_rows: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        orders: list[dict[str, Any]] = []
        seen_event_keys: set[str] = set()

        for row in history_rows:
            mapped = self._map_order_history_row(row)
            if mapped is None or mapped["eventKey"] in seen_event_keys:
                continue
            seen_event_keys.add(mapped["eventKey"])
            orders.append(mapped)

        orders.sort(key=lambda row: (row["eventTime"], row["remoteOrderId"]))
        return orders

    def _history_row_to_fill(
        self, row: dict[str, Any]
    ) -> RithmicFillRecord | None:
        remote_order_id = str(
            row.get("basket_id")
            or row.get("order_id")
            or row.get("exchange_order_id")
            or ""
        ).strip()
        symbol = str(row.get("symbol") or "").strip()
        account_id = str(row.get("account_id") or "").strip()
        exchange = self._normalize_exchange(row.get("exchange"))
        event_time = self._extract_event_datetime(row)
        side = self._transaction_type_to_side(row.get("transaction_type"))
        volume = self._to_float(row.get("total_fill_size"))
        price = self._to_float(row.get("avg_fill_price") or row.get("price"))

        if (
            not remote_order_id
            or not symbol
            or not account_id
            or event_time is None
            or side is None
            or volume is None
            or volume <= 0
            or price is None
        ):
            return None

        status = str(row.get("status") or "").lower()
        if status and "reject" in status:
            return None

        return RithmicFillRecord(
            remote_order_id=remote_order_id,
            account_id=account_id,
            symbol=symbol,
            exchange=exchange,
            side=side,
            volume=volume,
            price=price,
            event_time=event_time,
            comment=str(row.get("user_tag") or "").strip() or None,
            commission=self._to_float(
                row.get("default_commission")
                or row.get("commission")
                or row.get("commission_fill_rate")
            ),
            fee=self._to_float(row.get("fee") or row.get("exchange_fee")),
            raw=row,
        )

    def _build_deal_event(
        self,
        *,
        fill: RithmicFillRecord,
        deal_suffix: str,
        position_id: str,
        entry_type: str,
        volume: float,
        profit: float | None,
    ) -> dict[str, Any]:
        ratio = volume / fill.volume if fill.volume > 0 else 1.0

        return {
            "remoteDealId": f"{fill.remote_order_id}:{deal_suffix}",
            "remoteOrderId": fill.remote_order_id,
            "positionId": position_id,
            "entryType": entry_type,
            "side": fill.side,
            "symbol": fill.symbol,
            "volume": volume,
            "price": fill.price,
            "profit": profit,
            "commission": self._scale_nullable(fill.commission, ratio),
            "swap": None,
            "fee": self._scale_nullable(fill.fee, ratio),
            "sl": None,
            "tp": None,
            "comment": fill.comment,
            "eventTime": to_api_timestamp(fill.event_time),
            "rawPayload": fill.raw,
        }

    def _map_account_snapshot(
        self,
        *,
        account_id: str,
        system_name: str,
        gateway_url: str,
        snapshot_time: datetime,
        account_summary_rows: list[dict[str, Any]],
        account_rows: list[dict[str, Any]],
    ) -> dict[str, Any]:
        account_summary = account_summary_rows[0] if account_summary_rows else {}
        account_info = next(
            (row for row in account_rows if str(row.get("account_id")) == account_id),
            account_rows[0] if account_rows else {},
        )

        balance = self._to_float(
            account_summary.get("account_balance")
            or account_summary.get("cash_on_hand")
        )
        equity = self._to_float(
            account_summary.get("mtm_account")
            or account_summary.get("account_balance")
            or account_summary.get("cash_on_hand")
        )
        margin = self._to_float(account_summary.get("margin_balance"))
        free_margin = self._to_float(account_summary.get("available_buying_power"))

        return {
            "login": account_id,
            "serverName": system_name,
            "brokerName": "Rithmic",
            "currency": str(
                account_info.get("account_currency")
                or account_summary.get("currency")
                or "USD"
            ),
            "leverage": None,
            "balance": balance if balance is not None else 0,
            "equity": equity if equity is not None else (balance if balance is not None else 0),
            "margin": margin,
            "freeMargin": free_margin,
            "marginLevel": None,
            "snapshotTime": to_api_timestamp(snapshot_time),
            "rawPayload": {
                "accountSummary": account_summary,
                "account": account_info,
                "gatewayUrl": gateway_url,
            },
        }

    def _map_order_history_row(self, row: dict[str, Any]) -> dict[str, Any] | None:
        event_time = self._extract_event_time(row)
        remote_order_id = (
            row.get("basket_id")
            or row.get("order_id")
            or row.get("exchange_order_id")
        )
        symbol = row.get("symbol")

        if not remote_order_id or not event_time:
            return None

        transaction_type = self._transaction_type_to_side(row.get("transaction_type"))

        return {
            "eventKey": f"rithmic:{remote_order_id}:{event_time}",
            "remoteOrderId": str(remote_order_id),
            "positionId": None,
            "side": transaction_type,
            "orderType": str(row.get("price_type") or "") or None,
            "state": str(row.get("status") or row.get("report_type") or "") or None,
            "symbol": str(symbol) if symbol else None,
            "requestedVolume": self._to_float(row.get("quantity")),
            "filledVolume": self._to_float(row.get("total_fill_size")),
            "price": self._to_float(row.get("avg_fill_price") or row.get("price")),
            "sl": None,
            "tp": None,
            "comment": str(row.get("user_tag") or "").strip() or None,
            "eventTime": event_time,
            "rawPayload": row,
        }

    def _calculate_realized_profit(
        self,
        *,
        side: str,
        open_price: float,
        close_price: float,
        volume: float,
        contract_spec: RithmicContractSpec,
    ) -> float | None:
        if volume <= 0:
            return None

        price_delta = close_price - open_price if side == "buy" else open_price - close_price
        if contract_spec.tick_size and contract_spec.tick_value:
            ticks = price_delta / contract_spec.tick_size
            return round(ticks * contract_spec.tick_value * volume, 2)

        if contract_spec.multiplier:
            return round(price_delta * contract_spec.multiplier * volume, 2)

        return round(price_delta * volume, 2)

    def _resolve_account_id(
        self,
        *,
        credentials: dict[str, Any],
        meta: dict[str, Any],
        account_rows: list[dict[str, Any]],
    ) -> str:
        explicit_account_id = (
            str(credentials.get("accountId", "")).strip()
            or str(meta.get("rithmicAccountId", "")).strip()
        )
        if explicit_account_id:
            return explicit_account_id

        if not account_rows:
            raise RuntimeError("Rithmic did not return any authorized accounts")

        return str(account_rows[0].get("account_id") or account_rows[0].get("accountId"))

    def _extract_event_datetime(self, row: dict[str, Any]) -> datetime | None:
        ssboe = self._to_float(row.get("ssboe"))
        if ssboe is None:
            return None
        usecs = int(self._to_float(row.get("usecs")) or 0)
        return datetime.fromtimestamp(ssboe, tz=timezone.utc).replace(
            microsecond=max(0, min(usecs, 999999))
        )

    def _extract_event_time(self, row: dict[str, Any]) -> str | None:
        event_time = self._extract_event_datetime(row)
        return to_api_timestamp(event_time) if event_time else None

    def _normalize_exchange(self, value: Any) -> str | None:
        normalized = str(value or "").strip()
        return normalized or None

    def _transaction_type_to_side(self, value: Any) -> str | None:
        numeric = int(self._to_float(value) or 0)
        if numeric == 1:
            return "buy"
        if numeric == 2:
            return "sell"
        return None

    def _parse_history_date(self, value: str):
        return datetime.strptime(value, "%Y%m%d").date()

    def _scale_nullable(self, value: float | None, ratio: float) -> float | None:
        if value is None:
            return None
        return round(value * ratio, 8)

    def _to_payload_dict(self, plant: Any, row: Any) -> dict[str, Any]:
        if isinstance(row, dict):
            return row

        if hasattr(plant, "_response_to_dict"):
            return serialize_for_json(plant._response_to_dict(row))

        return serialize_for_json(row)

    def _to_float(self, value: Any) -> float | None:
        if value is None or value == "":
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            return float(str(value))
        except (TypeError, ValueError):
            return None
