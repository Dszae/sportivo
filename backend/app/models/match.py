from sqlalchemy import Column, String, Integer, BigInteger, Boolean, Text, JSON, DateTime, func
from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id = Column(String(128), primary_key=True, index=True)
    title = Column(String(256), nullable=False)
    category = Column(String(64), nullable=False, index=True)  # football, cricket, basketball
    status = Column(String(32), default="Upcoming", index=True)
    timestamp = Column(BigInteger, nullable=False, index=True)
    venue = Column(String(256), nullable=True)
    league = Column(String(128), nullable=True)
    home_score = Column(String(32), nullable=True)
    away_score = Column(String(32), nullable=True)
    sources = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class NplFixture(Base):
    __tablename__ = "npl_fixtures"

    id = Column(String(64), primary_key=True, index=True)
    match_number = Column(Integer, nullable=False, unique=True, index=True)
    round = Column(String(64), default="League Stage")
    home_team = Column(String(128), nullable=False)
    home_team_short = Column(String(16), nullable=False)
    home_team_logo = Column(String(512), nullable=True)
    home_team_color = Column(String(32), default="#ef4444")
    away_team = Column(String(128), nullable=False)
    away_team_short = Column(String(16), nullable=False)
    away_team_logo = Column(String(512), nullable=True)
    away_team_color = Column(String(32), default="#3b82f6")
    timestamp = Column(BigInteger, nullable=False, index=True)
    venue = Column(String(256), default="TU Cricket Ground, Kirtipur")
    status = Column(String(32), default="UPCOMING", index=True)  # UPCOMING, LIVE, COMPLETED
    home_score = Column(String(64), nullable=True)
    away_score = Column(String(64), nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class NplStanding(Base):
    __tablename__ = "npl_standings"

    rank = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False, unique=True)
    short = Column(String(16), nullable=False)
    p = Column(Integer, default=0)
    w = Column(Integer, default=0)
    l = Column(Integer, default=0)
    nr = Column(Integer, default=0)
    pts = Column(Integer, default=0)
    nrr = Column(String(32), default="0.000")
    logo = Column(String(512), nullable=True)
    color = Column(String(32), nullable=True)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    endpoint = Column(Text, nullable=False, unique=True)
    p256dh = Column(String(256), nullable=True)
    auth = Column(String(256), nullable=True)
    device_token = Column(String(256), nullable=True, index=True)
    platform = Column(String(32), default="android")  # android, ios, web
    subscribed_topics = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
