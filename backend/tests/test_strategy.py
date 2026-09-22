"""Engine selection, score threshold, and hard vetoes. No broker import."""

import ast
from pathlib import Path

from app.features.types import Features
from app.strategy.evaluate import apply_hard_vetoes, evaluate
from app.strategy.types import VetoContext
from app.strategy.version import promote_live


def _features(**overrides) -> Features:
    base = dict(
        close=100,
        ema9=99,
        ema21=98,
        ema50=97,
        sma50=96,
        rsi=60,
        atr=1.2,
        adx=30,
        vwap=99,
        volume_ratio=1.4,
        spread_bps=8,
        bb_bandwidth=6,
        bb_bandwidth_prev=6,
        macd_hist=0.4,
        reclaiming=False,
        close_outside_band=False,
    )
    base.update(overrides)
    return Features(**base)


def test_each_engine_allows_and_denies():
    assert evaluate(_features()).engine == "trend"
    assert evaluate(_features(rsi=40)).engine is None

    breakout = evaluate(_features(
        rsi=50,
        bb_bandwidth_prev=3,
        bb_bandwidth=6,
        close_outside_band=True,
    ))
    assert breakout.engine == "breakout"

    both = evaluate(_features(
        bb_bandwidth_prev=3,
        bb_bandwidth=6,
        close_outside_band=True,
    ))
    assert both.engine == "trend"

    reversion = evaluate(_features(
        adx=15,
        rsi=30,
        reclaiming=True,
        bb_bandwidth_prev=10,
        ema9=90,
        ema21=95,
        ema50=97,
    ))
    assert reversion.engine == "mean_reversion"
    denied = evaluate(_features(adx=15, rsi=30, reclaiming=False, bb_bandwidth_prev=10))
    assert denied.engine is None

    assert evaluate(_features(adx=20)).veto_code == "NO_TRADE_TRANSITION"


def test_score_threshold_and_hard_vetoes():
    traded = evaluate(_features())
    assert traded.score >= 70
    assert traded.action == "trade"

    watched = evaluate(_features(macd_hist=-0.2, volume_ratio=0.2, spread_bps=20))
    assert 60 <= watched.score < 70
    assert watched.action == "watch"

    perfect = evaluate(_features())
    context = VetoContext(expected_cost=1, gross_target=2)
    vetoed = apply_hard_vetoes(perfect, context)
    assert vetoed.veto_code == "NO_TRADE_COST"
    assert vetoed.score >= 70

    codes = {
        "NO_TRADE_DAILY_LOCK": VetoContext(locked=True),
        "NO_TRADE_HALT": VetoContext(halted=True),
        "NO_TRADE_UNKNOWN_ACCOUNT": VetoContext(account_known=False),
        "NO_TRADE_STALE_DATA": VetoContext(stale=True),
        "NO_TRADE_DUPLICATE": VetoContext(duplicate=True),
        "NO_TRADE_WIDE_SPREAD": VetoContext(spread_bps=40),
        "NO_TRADE_COST": VetoContext(expected_cost=2, gross_target=3),
        "NO_TRADE_RISK_CAP": VetoContext(risk_capped=True),
    }
    for code, ctx in codes.items():
        assert apply_hard_vetoes(perfect, ctx).veto_code == code


def test_strategy_package_does_not_import_alpaca():
    root = Path(__file__).resolve().parents[1] / "app" / "strategy"
    for path in root.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module and "alpaca" in node.module:
                raise AssertionError(path)
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert "alpaca" not in alias.name


def test_only_one_version_stays_live():
    first = {"name": "a", "params": {"adx": 23}, "is_live": True}
    second = {"name": "b", "params": {"adx": 23}, "is_live": False}
    promote_live([first, second], second)
    assert first["is_live"] is False
    assert second["is_live"] is True
