"""Tests for the MindSync API.

Run from the backend directory:
    pytest -v
"""
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import main
from main import app

client = TestClient(app)


def mock_response(text):
    """Build a fake Anthropic SDK response object."""
    block = MagicMock()
    block.text = text
    resp = MagicMock()
    resp.content = [block]
    return resp


@pytest.fixture(autouse=True)
def reset_limiter():
    """Clear rate limit state between tests so limits don't leak across cases."""
    main.limiter.reset()
    yield


@pytest.fixture
def fake_client():
    """Patch the module-level Anthropic client with a mock."""
    with patch.object(main, "client") as mock:
        yield mock


# ---------- health ----------

def test_root_returns_ok():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_health_reports_ai_configured(fake_client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["ai_configured"] is True


# ---------- generate ----------

def test_generate_returns_cards(fake_client):
    fake_client.messages.create.return_value = mock_response(
        '[{"q": "What is a variable?", "a": "A named container for a value"}]'
    )
    res = client.post("/generate", json={"notes": "Python basics", "count": 1})
    assert res.status_code == 200
    cards = json.loads(res.json()["flashcards"])
    assert len(cards) == 1
    assert cards[0]["q"] == "What is a variable?"


def test_generate_strips_markdown_fences(fake_client):
    fake_client.messages.create.return_value = mock_response(
        '```json\n[{"q": "Q", "a": "A"}]\n```'
    )
    res = client.post("/generate", json={"notes": "notes", "count": 1})
    assert res.status_code == 200
    assert json.loads(res.json()["flashcards"])[0]["a"] == "A"


def test_generate_rejects_empty_notes():
    res = client.post("/generate", json={"notes": "", "count": 5})
    assert res.status_code == 422


def test_generate_rejects_count_over_limit():
    res = client.post("/generate", json={"notes": "x", "count": 500})
    assert res.status_code == 422


def test_generate_passes_difficulty_into_prompt(fake_client):
    fake_client.messages.create.return_value = mock_response('[{"q":"Q","a":"A"}]')
    client.post("/generate", json={"notes": "x", "count": 1, "difficulty": "advanced"})
    system_prompt = fake_client.messages.create.call_args.kwargs["system"]
    assert "advanced" in system_prompt
    assert "reasoning" in system_prompt.lower()


def test_generate_handles_malformed_model_json(fake_client):
    fake_client.messages.create.return_value = mock_response("not json at all")
    res = client.post("/generate", json={"notes": "x", "count": 1})
    assert res.status_code == 502
    assert "malformed" in res.json()["detail"].lower()


# ---------- images ----------

def test_image_endpoint_rejects_bad_media_type(fake_client):
    res = client.post(
        "/generate-from-image",
        json={"image": "abc", "media_type": "image/tiff", "count": 3},
    )
    assert res.status_code == 400
    assert "Unsupported" in res.json()["detail"]


def test_image_endpoint_accepts_png(fake_client):
    fake_client.messages.create.return_value = mock_response('[{"q":"Q","a":"A"}]')
    res = client.post(
        "/generate-from-image",
        json={"image": "base64data", "media_type": "image/png", "count": 1},
    )
    assert res.status_code == 200


# ---------- grading ----------

def test_grade_answer_returns_score(fake_client):
    fake_client.messages.create.return_value = mock_response(
        '{"score": 85, "verdict": "partial", "feedback": "Close, but missing the second half."}'
    )
    res = client.post(
        "/grade-answer",
        json={"question": "What is 2+2?", "correct_answer": "4", "user_answer": "four"},
    )
    assert res.status_code == 200
    result = json.loads(res.json()["result"])
    assert result["score"] == 85
    assert result["verdict"] == "partial"


def test_grade_answer_rejects_empty_answer():
    res = client.post(
        "/grade-answer",
        json={"question": "Q", "correct_answer": "A", "user_answer": ""},
    )
    assert res.status_code == 422


# ---------- adapt ----------

def test_adapt_card_rejects_bad_direction(fake_client):
    res = client.post(
        "/adapt-card",
        json={"question": "Q", "answer": "A", "direction": "sideways"},
    )
    assert res.status_code == 400


def test_adapt_card_easier_uses_simplify_prompt(fake_client):
    fake_client.messages.create.return_value = mock_response('{"q": "Simpler?", "a": "Yes"}')
    res = client.post(
        "/adapt-card",
        json={"question": "Q", "answer": "A", "direction": "easier"},
    )
    assert res.status_code == 200
    system_prompt = fake_client.messages.create.call_args.kwargs["system"]
    assert "easier" in system_prompt.lower()


# ---------- quiz and analysis ----------

def test_build_quiz_returns_questions(fake_client):
    fake_client.messages.create.return_value = mock_response(
        '[{"q": "Pick one", "options": ["a","b","c","d"], "correct": 2}]'
    )
    res = client.post(
        "/build-quiz",
        json={"cards": [{"q": "Q", "a": "A"}], "mode": "multiple_choice"},
    )
    assert res.status_code == 200
    quiz = json.loads(res.json()["quiz"])
    assert quiz[0]["correct"] == 2
    assert len(quiz[0]["options"]) == 4


def test_build_quiz_rejects_empty_card_list():
    res = client.post("/build-quiz", json={"cards": [], "mode": "multiple_choice"})
    assert res.status_code == 422


def test_analyze_weakness_returns_practice_cards(fake_client):
    fake_client.messages.create.return_value = mock_response(
        '{"summary": "Struggling with cell division.", '
        '"weak_topics": ["Mitosis"], '
        '"practice_cards": [{"q": "What is anaphase?", "a": "Chromatids separate"}]}'
    )
    res = client.post(
        "/analyze-weakness",
        json={"missed_cards": [{"q": "What is mitosis?", "a": "Cell division"}]},
    )
    assert res.status_code == 200
    analysis = json.loads(res.json()["analysis"])
    assert "Mitosis" in analysis["weak_topics"]
    assert len(analysis["practice_cards"]) == 1


# ---------- tutor ----------

def test_explain_card_returns_prose(fake_client):
    fake_client.messages.create.return_value = mock_response(
        "Mitosis is how one cell becomes two identical cells."
    )
    res = client.post(
        "/explain-card",
        json={"question": "What is mitosis?", "answer": "Cell division"},
    )
    assert res.status_code == 200
    assert "Mitosis" in res.json()["explanation"]


def test_explain_card_truncates_long_history(fake_client):
    fake_client.messages.create.return_value = mock_response("Answer.")
    history = [{"role": "user", "content": f"msg {i}"} for i in range(30)]
    client.post(
        "/explain-card",
        json={"question": "Q", "answer": "A", "history": history, "user_question": "more?"},
    )
    sent = fake_client.messages.create.call_args.kwargs["messages"]
    assert len(sent) <= 11


# ---------- error mapping ----------

def test_missing_api_key_returns_503():
    with patch.object(main, "client", None):
        res = client.post("/generate", json={"notes": "x", "count": 1})
    assert res.status_code == 503
    assert "not configured" in res.json()["detail"].lower()


def test_rate_limit_error_maps_to_429(fake_client):
    import anthropic
    fake_client.messages.create.side_effect = anthropic.RateLimitError(
        message="slow down", response=MagicMock(status_code=429), body=None
    )
    res = client.post("/generate", json={"notes": "x", "count": 1})
    assert res.status_code == 429


def test_suggest_name_returns_name_and_topic(fake_client):
    fake_client.messages.create.return_value = mock_response(
        '{"name": "Cell Biology Basics", "topic": "Science"}'
    )
    res = client.post("/suggest-name", json={"cards": [{"q": "Q", "a": "A"}]})
    assert res.status_code == 200
    suggestion = json.loads(res.json()["suggestion"])
    assert suggestion["topic"] == "Science"
