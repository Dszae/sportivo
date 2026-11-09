from fastapi import APIRouter
from typing import List, Dict, Any
from app.redis_client import redis_service

router = APIRouter(prefix="/api/matches", tags=["Matches"])

SAMPLE_MATCHES = {
    "football": [
        {
            "id": "fb-arsenal-chelsea",
            "title": "Arsenal vs Chelsea",
            "category": "football",
            "status": "Live",
            "timestamp": 1794225000000,
            "venue": "Emirates Stadium, London",
            "league": "Premier League",
            "homeScore": "2",
            "awayScore": "1",
            "sources": [{"source": "strmfree", "id": "ars-che", "label": "Main Feed"}]
        },
        {
            "id": "fb-real-barca",
            "title": "Real Madrid vs Barcelona",
            "category": "football",
            "status": "Upcoming",
            "timestamp": 1794235800000,
            "venue": "Santiago Bernabéu, Madrid",
            "league": "La Liga",
            "sources": [{"source": "strmfree", "id": "rma-fcb", "label": "El Clásico HD"}]
        }
    ],
    "cricket": [
        {
            "id": "cr-ind-aus",
            "title": "India vs Australia",
            "category": "cricket",
            "status": "Live",
            "timestamp": 1794210000000,
            "venue": "Melbourne Cricket Ground",
            "league": "Border-Gavaskar Trophy",
            "homeScore": "284/7",
            "awayScore": "190/4",
            "sources": [{"source": "cric", "id": "ind-aus-test", "label": "Fox Cricket HD"}]
        }
    ],
    "basketball": [
        {
            "id": "bb-lal-gsw",
            "title": "Los Angeles Lakers vs Golden State Warriors",
            "category": "basketball",
            "status": "Upcoming",
            "timestamp": 1794250000000,
            "venue": "Crypto.com Arena, Los Angeles",
            "league": "NBA",
            "sources": [{"source": "nba", "id": "lal-gsw", "label": "ESPN HD"}]
        }
    ]
}


@router.get("/{category}/")
async def get_matches_by_category(category: str):
    """Returns fixtures for football, cricket, or basketball with Redis caching."""
    cat = category.lower()
    cache_key = f"matches_{cat}_cache"
    cached = await redis_service.get(cache_key)
    if cached and isinstance(cached, list):
        return cached

    matches = SAMPLE_MATCHES.get(cat, [])
    await redis_service.set(cache_key, matches, expire_seconds=30)
    return matches
