from abc import ABC, abstractmethod
from typing import Any


class MtAdapter(ABC):
    @abstractmethod
    def collect_frame(self, bootstrap: dict[str, Any], lookback_days: int) -> dict[str, Any]:
        raise NotImplementedError

    def release_connection(self, connection_id: str) -> None:
        return None

    def close(self) -> None:
        return None
