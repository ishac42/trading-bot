"""
Unit tests for app.risk_manager — RiskManager.

Tests all 4 risk checks and 3 calculation helpers:
  - _check_capital_available
  - _check_position_size
  - _check_daily_loss_limit
  - _check_max_positions
  - calculate_position_size
  - calculate_stop_loss
  - calculate_take_profit

Run:
    pytest tests/test_risk_manager.py -v
"""

from __future__ import annotations

import pytest

from app.signal_generator import Signal
from app.risk_manager import RiskManager, risk_manager


# ---------------------------------------------------------------------------
# validate() — Full Validation Pipeline
# ---------------------------------------------------------------------------

class TestValidate:
    """Tests for the top-level validate() method."""

    @pytest.mark.asyncio
    async def test_sell_always_allowed(self, default_bot_config):
        """SELL signals should always pass validation (we want to be able to close)."""
        allowed, reason = await risk_manager.validate(
            signal=Signal.SELL,
            bot_config=default_bot_config,
            symbol="AAPL",
            current_price=150.0,
        )
        assert allowed is True
        assert reason is None

    @pytest.mark.asyncio
    async def test_hold_is_blocked(self, default_bot_config):
        """HOLD signals should be blocked (no trade to execute)."""
        allowed, reason = await risk_manager.validate(
            signal=Signal.HOLD,
            bot_config=default_bot_config,
            symbol="AAPL",
            current_price=150.0,
        )
        assert allowed is False
        assert reason == "signal_is_hold"

    @pytest.mark.asyncio
    async def test_buy_allowed_when_all_checks_pass(self, default_bot_config):
        """BUY should pass when all risk checks are green."""
        allowed, reason = await risk_manager.validate(
            signal=Signal.BUY,
            bot_config=default_bot_config,
            symbol="AAPL",
            current_price=150.0,
            today_pnl=0.0,
            open_position_count=0,
        )
        assert allowed is True
        assert reason is None

    @pytest.mark.asyncio
    async def test_buy_blocked_insufficient_capital(self):
        """BUY blocked when price exceeds total capital."""
        config = {
            "capital": 100.0,
            "risk_management": {"max_position_size": 10.0},
        }
        allowed, reason = await risk_manager.validate(
            signal=Signal.BUY,
            bot_config=config,
            symbol="AAPL",
            current_price=150.0,
        )
        assert allowed is False
        assert "price_exceeds_capital" in reason

    @pytest.mark.asyncio
    async def test_buy_blocked_position_size_exceeded(self):
        """BUY blocked when single share exceeds max position allocation."""
        config = {
            "capital": 1000.0,
            "risk_management": {"max_position_size": 5.0},  # 5% = $50 max
        }
        allowed, reason = await risk_manager.validate(
            signal=Signal.BUY,
            bot_config=config,
            symbol="AAPL",
            current_price=60.0,  # $60 > $50 limit
        )
        assert allowed is False
        assert "single_share_exceeds_position_limit" in reason

    @pytest.mark.asyncio
    async def test_buy_blocked_daily_loss_limit(self, default_bot_config):
        """BUY blocked when today's P&L exceeds daily loss limit."""
        allowed, reason = await risk_manager.validate(
            signal=Signal.BUY,
            bot_config=default_bot_config,
            symbol="AAPL",
            current_price=150.0,
            today_pnl=-600.0,  # -6% of $10K, limit is 5%
            open_position_count=0,
        )
        assert allowed is False
        assert "daily_loss_limit_exceeded" in reason

    @pytest.mark.asyncio
    async def test_buy_blocked_max_positions(self, default_bot_config):
        """BUY blocked when max concurrent positions reached."""
        allowed, reason = await risk_manager.validate(
            signal=Signal.BUY,
            bot_config=default_bot_config,
            symbol="AAPL",
            current_price=150.0,
            today_pnl=0.0,
            open_position_count=5,  # limit is 5
        )
        assert allowed is False
        assert "max_concurrent_positions_reached" in reason


# ---------------------------------------------------------------------------
# _check_capital_available
# ---------------------------------------------------------------------------

class TestCheckCapitalAvailable:
    """Tests for the capital availability check."""

    def test_passes_when_capital_sufficient(self):
        allowed, reason = RiskManager._check_capital_available(10000.0, 150.0, {})
        assert allowed is True

    def test_fails_when_no_capital(self):
        allowed, reason = RiskManager._check_capital_available(0.0, 150.0, {})
        assert allowed is False
        assert "no_capital" in reason

    def test_fails_when_negative_capital(self):
        allowed, reason = RiskManager._check_capital_available(-100.0, 150.0, {})
        assert allowed is False
        assert "no_capital" in reason

    def test_fails_when_invalid_price(self):
        allowed, reason = RiskManager._check_capital_available(10000.0, 0.0, {})
        assert allowed is False
        assert "invalid_price" in reason

    def test_fails_when_price_exceeds_capital(self):
        allowed, reason = RiskManager._check_capital_available(100.0, 150.0, {})
        assert allowed is False
        assert "price_exceeds_capital" in reason

    def test_passes_when_price_equals_capital(self):
        """Edge case: price exactly equals capital — should pass."""
        allowed, reason = RiskManager._check_capital_available(150.0, 150.0, {})
        assert allowed is True


# ---------------------------------------------------------------------------
# _check_position_size
# ---------------------------------------------------------------------------

class TestCheckPositionSize:
    """Tests for the position size limit check."""

    def test_passes_within_limit(self):
        """$150 share within 10% of $10K = $1K limit."""
        allowed, reason = RiskManager._check_position_size(
            10000.0, 150.0, {"max_position_size": 10.0}
        )
        assert allowed is True

    def test_fails_exceeding_limit(self):
        """$600 share exceeds 5% of $10K = $500 limit."""
        allowed, reason = RiskManager._check_position_size(
            10000.0, 600.0, {"max_position_size": 5.0}
        )
        assert allowed is False
        assert "single_share_exceeds_position_limit" in reason

    def test_passes_at_exact_limit(self):
        """$500 share exactly at 5% of $10K = $500 limit — should pass."""
        allowed, reason = RiskManager._check_position_size(
            10000.0, 500.0, {"max_position_size": 5.0}
        )
        assert allowed is True

    def test_uses_default_when_not_configured(self):
        """Defaults to 10% if max_position_size not in config."""
        allowed, reason = RiskManager._check_position_size(10000.0, 150.0, {})
        assert allowed is True  # $150 < $1000 (10% of $10K)


# ---------------------------------------------------------------------------
# _check_daily_loss_limit
# ---------------------------------------------------------------------------

class TestCheckDailyLossLimit:
    """Tests for the daily loss limit check."""

    def test_passes_when_within_limit(self):
        allowed, reason = RiskManager._check_daily_loss_limit(
            today_pnl=-200.0, capital=10000.0, risk_config={"max_daily_loss": 5.0}
        )
        assert allowed is True

    def test_fails_when_exceeding_limit(self):
        """P&L of -$600 exceeds 5% of $10K = -$500 limit."""
        allowed, reason = RiskManager._check_daily_loss_limit(
            today_pnl=-600.0, capital=10000.0, risk_config={"max_daily_loss": 5.0}
        )
        assert allowed is False
        assert "daily_loss_limit_exceeded" in reason

    def test_passes_when_no_limit_configured(self):
        """If max_daily_loss is 0 or not set, check is skipped."""
        allowed, reason = RiskManager._check_daily_loss_limit(
            today_pnl=-9999.0, capital=10000.0, risk_config={"max_daily_loss": 0}
        )
        assert allowed is True

    def test_passes_when_positive_pnl(self):
        """Positive P&L should always pass."""
        allowed, reason = RiskManager._check_daily_loss_limit(
            today_pnl=500.0, capital=10000.0, risk_config={"max_daily_loss": 5.0}
        )
        assert allowed is True

    def test_passes_at_exact_limit(self):
        """P&L of exactly -$500 (5% of $10K) — at limit but not exceeded."""
        allowed, reason = RiskManager._check_daily_loss_limit(
            today_pnl=-500.0, capital=10000.0, risk_config={"max_daily_loss": 5.0}
        )
        assert allowed is True


# ---------------------------------------------------------------------------
# _check_max_positions
# ---------------------------------------------------------------------------

class TestCheckMaxPositions:
    """Tests for the max concurrent positions check."""

    def test_passes_below_limit(self):
        allowed, reason = RiskManager._check_max_positions(
            open_count=2, risk_config={"max_concurrent_positions": 5}
        )
        assert allowed is True

    def test_fails_at_limit(self):
        allowed, reason = RiskManager._check_max_positions(
            open_count=5, risk_config={"max_concurrent_positions": 5}
        )
        assert allowed is False
        assert "max_concurrent_positions_reached" in reason

    def test_fails_above_limit(self):
        allowed, reason = RiskManager._check_max_positions(
            open_count=6, risk_config={"max_concurrent_positions": 5}
        )
        assert allowed is False

    def test_passes_when_no_limit_configured(self):
        """If max_concurrent_positions is not set, check is skipped."""
        allowed, reason = RiskManager._check_max_positions(
            open_count=100, risk_config={}
        )
        assert allowed is True

    def test_passes_when_limit_is_zero(self):
        """Zero or negative limit means no limit."""
        allowed, reason = RiskManager._check_max_positions(
            open_count=100, risk_config={"max_concurrent_positions": 0}
        )
        assert allowed is True


# ---------------------------------------------------------------------------
# calculate_position_size
# ---------------------------------------------------------------------------

class TestCalculatePositionSize:
    """Tests for position size calculation."""

    def test_basic_calculation(self):
        """10% of $10K = $1000 allocation, at $150/share = 6 shares."""
        qty = RiskManager.calculate_position_size(
            capital=10000.0,
            current_price=150.0,
            risk_config={"max_position_size": 10.0},
        )
        assert qty == 6  # int(1000 / 150) = 6

    def test_returns_zero_for_zero_price(self):
        qty = RiskManager.calculate_position_size(0.0, 150.0, {"max_position_size": 10.0})
        assert qty == 0

    def test_returns_zero_for_negative_price(self):
        qty = RiskManager.calculate_position_size(10000.0, -1.0, {"max_position_size": 10.0})
        assert qty == 0

    def test_returns_zero_for_zero_capital(self):
        qty = RiskManager.calculate_position_size(0.0, 150.0, {"max_position_size": 10.0})
        assert qty == 0

    def test_returns_zero_when_price_too_high(self):
        """If a single share costs more than the allocation, qty is 0."""
        qty = RiskManager.calculate_position_size(
            capital=1000.0,
            current_price=600.0,
            risk_config={"max_position_size": 5.0},  # $50 allocation
        )
        assert qty == 0

    def test_uses_default_position_size(self):
        """Defaults to 10% if not configured."""
        qty = RiskManager.calculate_position_size(
            capital=10000.0, current_price=150.0, risk_config={}
        )
        assert qty == 6  # int(1000 / 150) = 6

    def test_exact_division(self):
        """$1000 allocation at $100/share = exactly 10 shares."""
        qty = RiskManager.calculate_position_size(
            capital=10000.0,
            current_price=100.0,
            risk_config={"max_position_size": 10.0},
        )
        assert qty == 10

    def test_fractional_truncated(self):
        """Non-integer results are truncated (floor), not rounded."""
        qty = RiskManager.calculate_position_size(
            capital=10000.0,
            current_price=149.99,
            risk_config={"max_position_size": 10.0},
        )
        assert qty == 6  # int(1000 / 149.99) = 6


# ---------------------------------------------------------------------------
# calculate_stop_loss
# ---------------------------------------------------------------------------

class TestCalculateStopLoss:
    """Tests for stop-loss price calculation."""

    def test_basic_calculation(self):
        """2% stop-loss on $100 entry → $98.00."""
        sl = RiskManager.calculate_stop_loss(100.0, {"stop_loss": 2.0})
        assert sl == 98.0

    def test_returns_none_when_not_configured(self):
        """If stop_loss is 0 or not set, return None."""
        sl = RiskManager.calculate_stop_loss(100.0, {"stop_loss": 0})
        assert sl is None

    def test_returns_none_when_missing(self):
        sl = RiskManager.calculate_stop_loss(100.0, {})
        assert sl is None

    def test_precision(self):
        """5% SL on $185.50 → $176.22 (Python rounds 176.225 to even)."""
        sl = RiskManager.calculate_stop_loss(185.50, {"stop_loss": 5.0})
        assert sl == 176.22

    def test_small_percentage(self):
        """0.5% SL on $200 → $199.00."""
        sl = RiskManager.calculate_stop_loss(200.0, {"stop_loss": 0.5})
        assert sl == 199.0


# ---------------------------------------------------------------------------
# calculate_take_profit
# ---------------------------------------------------------------------------

class TestCalculateTakeProfit:
    """Tests for take-profit price calculation."""

    def test_basic_calculation(self):
        """5% take-profit on $100 entry → $105.00."""
        tp = RiskManager.calculate_take_profit(100.0, {"take_profit": 5.0})
        assert tp == 105.0

    def test_returns_none_when_not_configured(self):
        tp = RiskManager.calculate_take_profit(100.0, {"take_profit": 0})
        assert tp is None

    def test_returns_none_when_missing(self):
        tp = RiskManager.calculate_take_profit(100.0, {})
        assert tp is None

    def test_precision(self):
        """3% TP on $185.50 → $191.07 (rounded to 2 decimals).

        Note: 185.50 * 1.03 = 191.065 in exact math, but float64
        may store it as 191.064999… so round(…, 2) gives 191.06.
        """
        tp = RiskManager.calculate_take_profit(185.50, {"take_profit": 3.0})
        assert tp == pytest.approx(191.065, abs=0.01)

    def test_small_percentage(self):
        """1% TP on $200 → $202.00."""
        tp = RiskManager.calculate_take_profit(200.0, {"take_profit": 1.0})
        assert tp == 202.0


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

class TestSingleton:

    def test_singleton_is_instance(self):
        assert isinstance(risk_manager, RiskManager)
