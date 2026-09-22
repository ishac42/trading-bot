"""Idempotent client order ids scoped to the book, not a bot."""

from __future__ import annotations

import uuid


def book_client_order_id(symbol: str, intent: str, nonce: str | None = None) -> str:
    token = nonce or uuid.uuid4().hex[:8]
    return f"book-{symbol.upper()}-{intent}-{token}"
