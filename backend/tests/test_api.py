import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.score_cleaner import clean_cricket_text

client = TestClient(app)


def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["app"] == "Sportivo API"
    assert data["version"] == "1.1.4"


def test_clean_cricket_text_mojibake():
    dirty = "â€¢ &l;b&g;Yuvraj Khatri&l;/b&g; comes in to bowl &quot;fast&quot;!"
    clean = clean_cricket_text(dirty)
    assert "•" in clean
    assert "&l;b&g;" not in clean
    assert "Yuvraj Khatri comes in to bowl \"fast\"!" in clean


def test_npl_live_moments_endpoint():
    res = client.get("/api/npl/live-moments/")
    assert res.status_code == 200
    data = res.json()
    assert "score" in data
    assert "overs" in data
    assert "header" in data
    assert "recentBalls" in data


def test_npl_fixtures_endpoint():
    res = client.get("/api/npl/fixtures/")
    assert res.status_code == 200
    fixtures = res.json()
    assert isinstance(fixtures, list)
    assert len(fixtures) > 0
    assert fixtures[0]["matchNumber"] == 19


def test_npl_standings_endpoint():
    res = client.get("/api/npl/standings/")
    assert res.status_code == 200
    standings = res.json()
    assert isinstance(standings, list)
    assert len(standings) == 8
    # Top ranked team
    assert standings[0]["rank"] == 1


def test_streams_all_endpoint():
    res = client.get("/api/stream/all/")
    assert res.status_code == 200
    data = res.json()
    assert "streams" in data
    assert len(data["streams"]) > 0
    # Server 1 should be multi-device pages.dev stream
    server_1 = data["streams"][0]
    assert "pages.dev" in server_1["embedUrl"]


def test_matches_by_category():
    res = client.get("/api/matches/football/")
    assert res.status_code == 200
    matches = res.json()
    assert isinstance(matches, list)
    assert len(matches) > 0
    assert matches[0]["category"] == "football"
