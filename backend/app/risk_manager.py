"""
Risk Manager — enforces trading rules before any order is submitted.

All checks must pass for a trade to be allowed. This module prevents:
  - Oversized positions (max % of capital per position)
  - Exceeding daily loss limits
  - Opening too many concurrent positions
  - Trading without sufficient capital
  - Missing stop-loss / take-profit configuration

Also provides calculation helpers for position sizing, stop-loss,
and take-profit price levels.
"""

from __future__ import annotations

import logging
from typing import Any

from app.signal_generator import Signal

logger = logging.getLogger(__name__)


class RiskManager:
    """
    Validates proposed trades against the bot's risk configuration.

    Usage::

        rm = RiskManager()
        allowed, reason = await rm.validate(
            signal=Signal.BUY,
            bot_config=config,
            symbol="AAPL",
            current_price=185.50,
            today_pnl=-150.0,
            open_position_count=2,
        )
        if not allowed:
            logger.info("Trade blocked: %s", reason)
    """

    async def validate(
        self,
        signal: Signal,
        bot_config: dict[str, Any],
        symbol: str,
        current_price: float,
        today_pnl: float = 0.0,
        open_position_count: int = 0,
    ) -> tuple[bool, str | None]:
        """
        Run all risk checks. Returns (allowed, reason).
        If allowed is True, reason is None.
        If allowed is False, reason explains which check failed.
        """
        risk_config = bot_config.get("risk_management", {})
        capital = bot_config.get("capital", 0)

        # Only validate BUY signals (SELL always allowed — we want to be able to close)
        if signal == Signal.SELL:
            return True, None

        if signal == Signal.HOLD:
            return False, "signal_is_hold"

        checks = [
            self._check_capital_available(capital, current_price, risk_config),
            self._check_position_size(capital, current_price, risk_config),
            self._check_daily_loss_limit(today_pnl, capital, risk_config),
            self._check_max_positions(open_position_count, risk_config),
        ]

        for allowed, reason in checks:
            if not allowed:
                logger.info(
                    "Risk check BLOCKED trade: %s %s @ %.2f — %s",
                    signal.value, symbol, current_price, reason,
                )
                return False, reason

        return True, None

    # ------------------------------------------------------------------
    # Risk checks
    # ------------------------------------------------------------------

    @staticmethod
    def _check_capital_available(
        capital: float,
        current_price: float,
        risk_config: dict[str, Any],
    ) -> tuple[bool, str | None]:
        """Ensure the bot has enough capital to buy at least 1 share."""
        if capital <= 0:
            return False, "no_capital"
        if current_price <= 0:
            return False, "invalid_price"
        if current_price > capital:
            return False, f"price_exceeds_capital ({current_price:.2f} > {capital:.2f})"
        return True, None

    @staticmethod
    def _check_position_size(
        capital: float,
        current_price: float,
        risk_config: dict[str, Any],
    ) -> tuple[bool, str | None]:
        """
        Ensure the position doesn't exceed max_position_size % of capital.
        Checks that at least 1 share can be purchased within the limit.
        """
        max_pct = risk_config.get("max_position_size", 10.0)  # default 10%
        max_allocation = capital * (max_pct / 100)

        if current_price > max_allocation:
            return False, (
                f"single_share_exceeds_position_limit "
                f"(price={current_price:.2f} > max_alloc={max_allocation:.2f} "
                f"= {max_pct}% of {capital:.2f})"
            )
        return True, None

    @staticmethod
    def _check_daily_loss_limit(
        today_pnl: float,
        capital: float,
        risk_config: dict[str, Any],
    ) -> tuple[bool, str | None]:
        """
        Block new buys if today's realized loss exceeds max_daily_loss %.
        E.g. max_daily_loss=10 means stop if P&L < -10% of capital.
        """
        max_daily_loss_pct = risk_config.get("max_daily_loss", 0)
        if max_daily_loss_pct <= 0 or capital <= 0:
            return True, None  # No limit configured

        max_loss = capital * (max_daily_loss_pct / 100)

        if today_pnl < -max_loss:
            return False, (
                f"daily_loss_limit_exceeded "
                f"(today_pnl={today_pnl:.2f} < max_loss=-{max_loss:.2f} "
                f"= {max_daily_loss_pct}% of {capital:.2f})"
            )
        return True, None

    @staticmethod
    def _check_max_positions(
        open_count: int,
        risk_config: dict[str, Any],
    ) -> tuple[bool, str | None]:
        """Block new buys if max concurrent positions is reached."""
        max_positions = risk_config.get("max_concurrent_positions")
        if max_positions is None or max_positions <= 0:
            return True, None  # No limit configured

        if open_count >= max_positions:
            return False, (
                f"max_concurrent_positions_reached "
                f"(open={open_count}, max={max_positions})"
            )
        return True, None

    # ------------------------------------------------------------------
    # Calculation helpers
    # ------------------------------------------------------------------

    @staticmethod
    def calculate_position_size(
        capital: float,
        current_price: float,
        risk_config: dict[str, Any],
    ) -> int:
        """
        Calculate number of shares to buy based on max_position_size %.

        Parameters
        ----------
        capital : float
            Bot's total capital allocation.
        current_price : float
            Current price per share.
        risk_config : dict
            Must contain 'max_position_size' (percentage, e.g. 10.0 for 10%).

        Returns
        -------
        int
            Number of whole shares (0 if price is invalid or allocation too small).
        """
        if current_price <= 0 or capital <= 0:
            return 0

        max_pct = risk_config.get("max_position_size", 10.0)
        allocation = capital * (max_pct / 100)
        qty = int(allocation / current_price)
        return max(qty, 0)

    @staticmethod
    def calculate_stop_loss(
        entry_price: float,
        risk_config: dict[str, Any],
    ) -> float | None:
        """
        Calculate stop-loss price.

        Parameters
        ----------
        entry_price : float
            The price at which the position was entered.
        risk_config : dict
            Must contain 'stop_loss' (percentage, e.g. 2.0 for 2%).

        Returns
        -------
        float | None
            Stop-loss price, or None if not configured.
        """
        sl_pct = risk_config.get("stop_loss", 0)
        if sl_pct > 0:
            return round(entry_price * (1 - sl_pct / 100), 2)
        return None

    @staticmethod
    def calculate_take_profit(
        entry_price: float,
        risk_config: dict[str, Any],
    ) -> float | None:
        """
        Calculate take-profit price.

        Parameters
        ----------
        entry_price : float
            The price at which the position was entered.
        risk_config : dict
            Must contain 'take_profit' (percentage, e.g. 5.0 for 5%).

        Returns
        -------
        float | None
            Take-profit price, or None if not configured.
        """
        tp_pct = risk_config.get("take_profit", 0)
        if tp_pct > 0:
            return round(entry_price * (1 + tp_pct / 100), 2)
        return None


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

risk_manager = RiskManager()
