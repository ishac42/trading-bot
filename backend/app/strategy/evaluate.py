"""Regime, one engine, and the score. Returns a candidate or a veto. Does not submit orders."""

from __future__ import annotations

from app.features.types import Features
from app.strategy.types import Evaluation, VetoContext

TREND = "trend"
BREAKOUT = "breakout"
MEAN_REVERSION = "mean_reversion"
TRANSITION = "transition"


def classify_regime(features: Features) -> str:
    if features.adx >= 23 and features.ema9 > features.ema21 > features.ema50:
        return "trend"
    if features.bb_bandwidth_prev <= 4 and features.bb_bandwidth > features.bb_bandwidth_prev:
        return "compression"
    if features.adx <= 18:
        return "range"
    return "transition"


def evaluate(features: Features) -> Evaluation:
    if features.frozen:
        return Evaluation(None, "transition", 0.0, action="veto", veto_code="NO_TRADE_STALE_DATA")
    regime = classify_regime(features)
    if 18 < features.adx < 23 or regime == "transition":
        return Evaluation(None, "transition", 0.0, action="veto", veto_code="NO_TRADE_TRANSITION")

    engine = _select_engine(features, regime)
    if engine is None:
        return Evaluation(None, regime, 0.0, action="veto", veto_code="NO_TRADE_NO_ENGINE")

    parts = _components(features, engine)
    score = (
        25 * parts["R"]
        + 20 * parts["T"]
        + 15 * parts["M"]
        + 15 * parts["S"]
        + 10 * parts["V"]
        + 10 * parts["O"]
        + 5 * parts["E"]
    )
    if score >= 70:
        action = "trade"
    elif score >= 60:
        action = "watch"
    else:
        action = "veto"
    code = None if action == "trade" else "NO_TRADE_SCORE"
    return Evaluation(engine, regime, round(score, 2), parts, action, code)


def apply_hard_vetoes(evaluation: Evaluation, context: VetoContext) -> Evaluation:
    """Hard vetoes beat score. This does not clear a halt and does not submit an order."""
    code = _veto_code(context)
    if code is None:
        return evaluation
    return Evaluation(
        evaluation.engine,
        evaluation.regime,
        evaluation.score,
        evaluation.components,
        "veto",
        code,
    )


def _select_engine(features: Features, regime: str) -> str | None:
    trend_ok = (
        features.adx >= 23
        and features.ema9 > features.ema21 > features.ema50
        and 55 <= features.rsi <= 72
    )
    breakout_ok = (
        features.adx >= 23
        and features.bb_bandwidth > features.bb_bandwidth_prev
        and features.bb_bandwidth_prev <= 4
        and features.close_outside_band
    )
    reversion_ok = (
        features.adx <= 18
        and 25 <= features.rsi <= 35
        and features.reclaiming
    )
    if trend_ok:
        return TREND
    if breakout_ok:
        return BREAKOUT
    if reversion_ok:
        return MEAN_REVERSION
    if regime == "transition":
        return None
    return None


def _components(features: Features, engine: str) -> dict[str, float]:
    trend_location = 1.0 if features.close >= features.vwap and features.ema9 >= features.ema21 else 0.0
    if engine == TREND:
        momentum = 1.0 if 55 <= features.rsi <= 72 else 0.0
    elif engine == MEAN_REVERSION:
        momentum = 1.0 if 25 <= features.rsi <= 35 else 0.0
    else:
        momentum = 1.0 if features.close_outside_band else 0.0
    setup = 1.0 if features.macd_hist > 0 else 0.0
    volume = 1.0 if features.volume_ratio >= 1 else 0.0
    order_flow = 1.0 if features.spread_bps <= 15 else 0.0
    if features.spread_bps <= 10:
        execution = 1.0
    elif features.spread_bps <= 15:
        execution = 0.5
    else:
        execution = 0.0
    return {
        "R": 1.0,
        "T": trend_location,
        "M": momentum,
        "S": setup,
        "V": volume,
        "O": order_flow,
        "E": execution,
    }


def _veto_code(context: VetoContext) -> str | None:
    if context.locked:
        return "NO_TRADE_DAILY_LOCK"
    if context.halted:
        return "NO_TRADE_HALT"
    if not context.account_known:
        return "NO_TRADE_UNKNOWN_ACCOUNT"
    if context.stale:
        return "NO_TRADE_STALE_DATA"
    if context.duplicate:
        return "NO_TRADE_DUPLICATE"
    if context.spread_bps > context.max_spread_bps:
        return "NO_TRADE_WIDE_SPREAD"
    if context.expected_cost > 0 and context.gross_target < 3 * context.expected_cost:
        return "NO_TRADE_COST"
    if context.risk_capped:
        return "NO_TRADE_RISK_CAP"
    return None
