"""Limit entries, shortfall, rejects, and idempotent client ids."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.execution.ids import book_client_order_id
from app.execution.orders import (
    ExecutionBook,
    OrderIntent,
    PaperBroker,
    ProtectedPosition,
    entry_limit,
    protect_position,
)
from app.models import BookOrder, User


def test_limit_entry_records_shortfall_and_reject_leaves_no_position():
    limit = entry_limit(bid=100, ask=100.05, max_slippage_bps=8, aggressive=False)
    assert limit <= 100.05
    intent = OrderIntent(
        client_order_id=book_client_order_id("AAPL", "entry", nonce="fixed1"),
        symbol="AAPL",
        side="buy",
        quantity=10,
        limit_price=limit,
        intent="entry",
    )
    broker = PaperBroker()
    book = ExecutionBook()
    fill = book.submit(intent, broker.submit_limit)
    assert fill.status == "filled"
    assert fill.shortfall != 0
    assert intent.order_type == "limit"
    assert len(broker.positions) == 1

    again = book.submit(intent, broker.submit_limit)
    assert again.client_order_id == fill.client_order_id
    assert len(broker.submits) == 1

    rejected = PaperBroker(reject=True)
    result = ExecutionBook().submit(intent, rejected.submit_limit)
    assert result.rejected is True
    assert rejected.positions == []


def test_unfilled_protective_sell_stays_open():
    position = ProtectedPosition("AAPL", 10, 100, protective_order_id="prot-1", protective_filled=False)
    protect_position(position, atr=1)
    assert position.is_open is True
    assert position.stop_price is None

    naked = ProtectedPosition("MSFT", 5, 50)
    protect_position(naked, atr=1)
    assert naked.software_stop is True
    assert naked.stop_price == 48.8
    assert naked.is_open is True


async def test_client_order_id_is_unique(async_engine):
    session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        session.add(User(
            id="user-1",
            email="runtime@example.com",
            name="Runtime",
            google_sub="runtime-sub",
        ))
        session.add(BookOrder(
            user_id="user-1",
            client_order_id="book-AAPL-entry-fixed",
            symbol="AAPL",
            side="buy",
            quantity=1,
            order_type="limit",
            status="filled",
        ))
        await session.commit()

    async with session_factory() as session:
        session.add(BookOrder(
            user_id="user-1",
            client_order_id="book-AAPL-entry-fixed",
            symbol="AAPL",
            side="buy",
            quantity=1,
            order_type="limit",
            status="pending",
        ))
        with pytest.raises(IntegrityError):
            await session.commit()
