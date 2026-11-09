from fastapi import APIRouter
from typing import List, Dict, Any
from app.services.npl_service import (
    fetch_live_scorer_moments,
    get_npl_fixtures,
    get_npl_standings,
)

router = APIRouter(prefix="/api/npl", tags=["NPL 2026"])


@router.get("/live-moments/")
async def get_live_moments():
    """Returns real-time ground-scorer telemetry, scores, and commentary."""
    return await fetch_live_scorer_moments()


@router.get("/fixtures/")
async def list_fixtures():
    """Returns official Nepal Premier League 2026 match schedule."""
    return await get_npl_fixtures()


@router.get("/standings/")
async def list_standings():
    """Returns official Nepal Premier League 2026 live standings table."""
    return await get_npl_standings()
