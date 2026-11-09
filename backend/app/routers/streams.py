from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.services.stream_service import discover_npl_streams

router = APIRouter(prefix="/api/stream", tags=["Streams"])


@router.get("/all/")
async def get_all_streams():
    """Returns all probed active live stream sources ranked by health and latency."""
    streams = await discover_npl_streams()
    return {
        "total": len(streams),
        "streams": streams,
    }


@router.get("/{source}/{match_id}/")
async def get_match_streams(source: str, match_id: str):
    """
    Returns multi-server broadcast streams for a specific match with
    automatic failover and multi-device Server 1 prioritization.
    """
    streams = await discover_npl_streams()
    if not streams:
        raise HTTPException(
            status_code=404,
            detail="Stream feed is currently offline or waiting for pre-match broadcast signal."
        )
    return streams
