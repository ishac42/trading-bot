"""
Research trials. One parameter set per attempt. Failures are stored.

This router is not a Settings grid and it does not restore bot CRUD.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import ResearchTrial, User
from app.research.harness import run_trial

router = APIRouter(prefix="/research", tags=["research"])


class BarIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float = 0
    spread_bps: float = 8


class TrialIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gate: str
    params: dict[str, Any] = Field(default_factory=dict)
    bars: list[BarIn] = Field(default_factory=list, max_length=5000)
    data_source: str = "historical_bars"
    passed_gates: list[str] = Field(default_factory=list)
    approved_hash: str | None = None


class TrialOut(BaseModel):
    id: str
    gate: str
    status: str
    failure_reason: str | None
    params_hash: str
    data_source: str
    metrics: dict[str, Any]


def _out(row: ResearchTrial) -> TrialOut:
    return TrialOut(
        id=row.id,
        gate=row.gate,
        status=row.status,
        failure_reason=row.failure_reason,
        params_hash=row.params_hash,
        data_source=row.data_source,
        metrics=row.metrics or {},
    )


@router.get("/trials", response_model=list[TrialOut])
async def list_trials(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ResearchTrial)
        .where(ResearchTrial.user_id == user.id)
        .order_by(ResearchTrial.created_at.desc())
    )
    return [_out(row) for row in result.scalars()]


@router.post("/trials", response_model=TrialOut, status_code=201)
async def create_trial(
    body: TrialIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    outcome = run_trial(
        [bar.model_dump() for bar in body.bars],
        gate=body.gate,
        params=body.params or None,
        data_source=body.data_source,
        passed_gates=body.passed_gates,
        approved_hash=body.approved_hash,
    )
    row = ResearchTrial(
        user_id=user.id,
        params=outcome["params"],
        params_hash=outcome["params_hash"],
        gate=outcome["gate"],
        status=outcome["status"],
        failure_reason=outcome["failure_reason"],
        metrics=outcome["metrics"],
        data_source=outcome["data_source"],
    )
    db.add(row)
    await db.flush()
    return _out(row)
