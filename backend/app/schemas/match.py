from pydantic import BaseModel, Field
from typing import List, Optional, Union, Dict, Any


class StreamSourceSchema(BaseModel):
    id: str
    source: str
    label: str
    embedUrl: str
    streamUrl: Optional[str] = None
    isDirectStream: bool = False
    hd: bool = True
    licenseUrl: Optional[str] = None


class MatchSchema(BaseModel):
    id: str
    title: str
    category: str
    status: str
    timestamp: int
    venue: Optional[str] = None
    league: Optional[str] = None
    homeScore: Optional[str] = None
    awayScore: Optional[str] = None
    sources: Optional[List[Dict[str, Any]]] = None
    streams: Optional[List[StreamSourceSchema]] = None


class NplFixtureSchema(BaseModel):
    id: str
    matchNumber: int
    round: str
    homeTeam: str
    homeTeamShort: str
    homeTeamLogo: Optional[str] = None
    homeTeamColor: Optional[str] = "#ef4444"
    awayTeam: str
    awayTeamShort: str
    awayTeamLogo: Optional[str] = None
    awayTeamColor: Optional[str] = "#3b82f6"
    timestamp: int
    venue: str
    status: str
    homeScore: Optional[str] = None
    awayScore: Optional[str] = None
    summary: Optional[str] = None


class NplStandingSchema(BaseModel):
    rank: int
    name: str
    short: str
    p: int
    w: int
    l: int
    nr: int = 0
    pts: int
    nrr: str
    logo: Optional[str] = None
    color: Optional[str] = None


class LiveScoreHeaderSchema(BaseModel):
    matchNumber: Optional[str] = None
    matchTitle: Optional[str] = None
    venue: Optional[str] = None
    tossNote: Optional[str] = None
    team1Short: Optional[str] = None
    team1Name: Optional[str] = None
    team1Score: Optional[str] = None
    team1Overs: Optional[str] = None
    team2Short: Optional[str] = None
    team2Name: Optional[str] = None
    team2Score: Optional[str] = None
    team2Overs: Optional[str] = None
    activeTeam: Optional[int] = 1
    target: Optional[str] = None
    crr: Optional[str] = None
    rrr: Optional[str] = None


class BatterSchema(BaseModel):
    name: str
    isOnStrike: bool
    runs: str
    balls: str
    fours: str
    sixes: str
    strikeRate: Optional[str] = None


class BowlerSchema(BaseModel):
    name: str
    figures: str
    overs: Optional[str] = None
    economy: Optional[str] = None


class DeliverySchema(BaseModel):
    over: int
    delivery: int
    code: str
    teamScore: Optional[str] = None
    isBoundary: bool = False
    isWicket: bool = False


class CommentaryItemSchema(BaseModel):
    ball: str
    bowlerToBatsman: str
    text: str
    outcome: Optional[str] = None
    isBoundary: Optional[bool] = False
    isWicket: Optional[bool] = False


class LiveMomentsResponseSchema(BaseModel):
    score: str
    overs: str
    crr: Optional[str] = None
    rrr: Optional[str] = None
    target: Optional[str] = None
    header: Optional[LiveScoreHeaderSchema] = None
    batters: Optional[List[BatterSchema]] = None
    bowler: Optional[BowlerSchema] = None
    recentBalls: List[DeliverySchema] = []
    commentary: List[CommentaryItemSchema] = []
    moments: Optional[List[Dict[str, Any]]] = None


class PushSubscribeRequest(BaseModel):
    endpoint: str
    p256dh: Optional[str] = None
    auth: Optional[str] = None
    deviceToken: Optional[str] = None
    platform: Optional[str] = "android"
    topics: Optional[List[str]] = None
