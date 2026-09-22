"""Locked strategy parameters. Promoting a version clears any other live row."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def params_hash(params: dict[str, Any]) -> str:
    payload = json.dumps(params, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def promote_live(versions: list[dict[str, Any]], candidate: dict[str, Any]) -> dict[str, Any]:
    for version in versions:
        version["is_live"] = False
    candidate["is_live"] = True
    candidate["promotion_state"] = "live"
    candidate["params_hash"] = params_hash(candidate.get("params") or {})
    return candidate
