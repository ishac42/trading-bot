"""Historical bar clock. No live stream and no broker import."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def bar_time(bar: dict[str, Any]) -> datetime:
    value = bar["timestamp"]
    if isinstance(value, datetime):
        moment = value
    else:
        moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment


def is_closed_five_minute(moment: datetime) -> bool:
    """True at a 5-minute boundary. The bucket that contains this instant is still open."""
    return moment.second == 0 and moment.microsecond == 0 and moment.minute % 5 == 0


def research_windows(count: int, holdout_ratio: float = 0.2, folds: int = 3) -> dict[str, list[range]]:
    """Walk-forward windows plus a locked holdout the search never sees."""
    if count < folds + 2:
        raise ValueError("not enough bars to separate walk-forward from holdout")
    holdout_start = int(count * (1 - holdout_ratio))
    holdout_start = min(max(holdout_start, folds), count - 1)
    fold = holdout_start // folds
    insample: list[range] = []
    oos: list[range] = []
    for index in range(folds):
        start = index * fold
        end = holdout_start if index == folds - 1 else (index + 1) * fold
        cut = start + max(1, int((end - start) * 0.7))
        if cut >= end:
            cut = end - 1
        insample.append(range(start, cut))
        oos.append(range(cut, end))
    return {
        "insample": insample,
        "oos": oos,
        "holdout": [range(holdout_start, count)],
    }
