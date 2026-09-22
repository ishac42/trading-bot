"""
Universe stream supervisor.

SIP quotes update eligibility. A stale quote or a feed drop freezes names and
emits data_health. This module does not submit orders.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Callable

STALE_AFTER_SECONDS = 5


class UniverseStream:
    def __init__(self, on_health: Callable[[dict], None] | None = None) -> None:
        self.members: list[str] = []
        self.frozen: set[str] = set()
        self.health_events: list[dict] = []
        self.last_bar: dict[str, datetime] = {}
        self._on_health = on_health

    def resubscribe(self, symbols: list[str]) -> None:
        self.members = list(symbols)
        self.frozen.intersection_update(self.members)

    def on_quote(self, symbol: str, quote_time: datetime, now: datetime) -> None:
        age = (now - quote_time).total_seconds()
        if age > STALE_AFTER_SECONDS:
            self.frozen.add(symbol)
            self._emit({"stale": True, "symbol": symbol, "age_seconds": age, "reason": "stale_quote"})
            return
        self.frozen.discard(symbol)

    def note_bar(self, symbol: str, timestamp: datetime) -> None:
        previous = self.last_bar.get(symbol)
        self.last_bar[symbol] = timestamp
        if previous is not None and timestamp - previous > timedelta(minutes=2):
            self.frozen.add(symbol)
            self._emit({"stale": True, "symbol": symbol, "reason": "gap"})

    def drop_feed(self) -> None:
        self.frozen.update(self.members)
        self._emit({"stale": True, "symbol": None, "reason": "feed_drop", "feed": "sip"})

    def eligible(self, symbol: str) -> bool:
        return symbol in self.members and symbol not in self.frozen

    def _emit(self, payload: dict) -> None:
        self.health_events.append(payload)
        if self._on_health:
            self._on_health(payload)


class TokenBucket:
    def __init__(self, rate_per_second: float, capacity: float) -> None:
        self.rate = rate_per_second
        self.capacity = capacity
        self.tokens = capacity
        self.updated: datetime | None = None

    def allow(self, now: datetime) -> bool:
        if self.updated is not None:
            elapsed = (now - self.updated).total_seconds()
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.updated = now
        if self.tokens < 1:
            return False
        self.tokens -= 1
        return True


def backoff_seconds(attempt: int, jitter: float = 0.0) -> float:
    base = min(30.0, 2 ** max(attempt, 0))
    return base + max(0.0, jitter)
