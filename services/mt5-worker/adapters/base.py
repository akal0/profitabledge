from abc import ABC, abstractmethod
from typing import Any


class MtAdapter(ABC):
    @abstractmethod
    def collect_frame(self, bootstrap: dict[str, Any], lookback_days: int) -> dict[str, Any]:
        raise NotImplementedError

    def execute_copy_signals(
        self,
        bootstrap: dict[str, Any],
        signals: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        return []

    def release_connection(self, connection_id: str) -> None:
        return None

    def close(self) -> None:
        return None
