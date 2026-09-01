import json
import logging
import os
from typing import List, Optional

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mindsync")

MODEL = "claude-sonnet-4-6"

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="MindSync API",
    description="AI flashcard generation, tutoring, quizzing, and gap analysis.",
    version="2.1.0",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_api_key = os.getenv("ANTHROPIC_API_KEY")
client = anthropic.Anthropic(api_key=_api_key) if _api_key else None

DIFFICULTY_GUIDE = {
    "beginner": "Use simple language. Focus on definitions and basic recall. Keep questions short and direct.",
    "intermediate": "Mix recall with understanding. Include some why and how questions alongside definitions.",
    "advanced": "Focus on application, analysis, and connections between concepts. Ask questions that require reasoning, not just memory.",
}


class GenerateRequest(BaseModel):
    notes: str = Field(min_length=1, max_length=100_000)
    count: int = Field(default=8, ge=1, le=50)
    difficulty: str = "intermediate"


class ImageRequest(BaseModel):
    image: str = Field(min_length=1)
    media_type: str
    count: int = Field(default=8, ge=1, le=50)
    difficulty: str = "intermediate"


class Card(BaseModel):
    q: str
    a: str


class ExplainRequest(BaseModel):
    question: str
    answer: str
    user_question: Optional[str] = None
    history: List[dict] = []


class GradeRequest(BaseModel):
    question: str
    correct_answer: str
    user_answer: str = Field(min_length=1, max_length=5_000)


class QuizRequest(BaseModel):
    cards: List[Card] = Field(min_length=1, max_length=50)
    mode: str = "multiple_choice"


class WeaknessRequest(BaseModel):
    missed_cards: List[Card] = Field(min_length=1, max_length=50)
    deck_name: str = "this deck"


class AdaptRequest(BaseModel):
    question: str
    answer: str
    direction: str


class NameRequest(BaseModel):
    cards: List[Card] = Field(min_length=1, max_length=50)


ALLOWED_MEDIA_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


def ask(system: str, messages: list, max_tokens: int = 1500) -> str:
    """Call Claude and map SDK errors onto meaningful HTTP status codes."""
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="The AI service is not configured. Set ANTHROPIC_API_KEY on the server.",
        )
    try:
        msg = client.messages.create(
            model=MODEL, max_tokens=max_tokens, system=system, messages=messages
        )
        return msg.content[0].text
    except anthropic.RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="The AI service is rate limited right now. Wait a moment and try again.",
        )
    except anthropic.AuthenticationError:
        raise HTTPException(
            status_code=503,
            detail="The AI service rejected our credentials. Check the server API key.",
        )
    except anthropic.APIStatusError as e:
        if e.status_code == 400 and "credit balance" in str(e).lower():
            raise HTTPException(
                status_code=402,
                detail="The AI account has no credits left. Add billing to continue.",
            )
        logger.error("Anthropic API error %s: %s", e.status_code, e)
        raise HTTPException(
            status_code=502, detail="The AI service returned an error. Try again."
        )
    except anthropic.APIConnectionError:
        raise HTTPException(
            status_code=504, detail="Could not reach the AI service. Check your connection."
        )
    except Exception as e:
        logger.exception("Unexpected error calling Anthropic: %s", e)
        raise HTTPException(status_code=500, detail="Something went wrong on our side.")


def parse_model_json(text: str, expect: str = "object"):
    """Strip markdown fences and parse. Raises 502 if the model returned junk."""
    cleaned = text.replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Model returned unparseable JSON: %s", cleaned[:300])
        raise HTTPException(
            status_code=502,
            detail="The AI returned a malformed response. Try generating again.",
        )
    if expect == "array" and not isinstance(data, list):
        raise HTTPException(status_code=502, detail="The AI returned an unexpected format.")
    if expect == "object" and not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="The AI returned an unexpected format.")
    return data


@app.get("/")
def root():
    return {"status": "ok", "service": "MindSync API", "version": "2.1.0"}


@app.get("/health")
def health():
    return {"status": "healthy", "ai_configured": client is not None}


@app.post("/generate")
@limiter.limit("20/minute")
async def generate_flashcards(request: Request, body: GenerateRequest):
    guide = DIFFICULTY_GUIDE.get(body.difficulty, DIFFICULTY_GUIDE["intermediate"])
    system = (
        f"You are a study assistant. Generate exactly {body.count} flashcards from the provided notes. "
        f"Difficulty level: {body.difficulty}. {guide} "
        'Return ONLY a valid JSON array, no markdown, no explanation. '
        'Format: [{"q": "question text", "a": "answer text"}, ...]'
    )
    text = ask(
        system,
        [{"role": "user", "content": f"Generate {body.count} flashcards from these notes:\n\n{body.notes}"}],
    )
    cards = parse_model_json(text, expect="array")
    if not cards:
        raise HTTPException(status_code=502, detail="The AI returned no cards. Try different notes.")
    return {"flashcards": json.dumps(cards)}


@app.post("/generate-from-image")
@limiter.limit("10/minute")
async def generate_from_image(request: Request, body: ImageRequest):
    if body.media_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {body.media_type}")
    guide = DIFFICULTY_GUIDE.get(body.difficulty, DIFFICULTY_GUIDE["intermediate"])
    system = (
        f"You are a study assistant. Generate exactly {body.count} flashcards from the content in this image. "
        f"Difficulty level: {body.difficulty}. {guide} "
        'Return ONLY a valid JSON array, no markdown, no explanation. '
        'Format: [{"q": "question text", "a": "answer text"}, ...]'
    )
    content = [
        {"type": "image", "source": {"type": "base64", "media_type": body.media_type, "data": body.image}},
        {"type": "text", "text": f"Generate {body.count} flashcards from this image."},
    ]
    text = ask(system, [{"role": "user", "content": content}])
    cards = parse_model_json(text, expect="array")
    if not cards:
        raise HTTPException(status_code=502, detail="No readable content found in that image.")
    return {"flashcards": json.dumps(cards)}


@app.post("/explain-card")
@limiter.limit("30/minute")
async def explain_card(request: Request, body: ExplainRequest):
    system = (
        "You are a friendly tutor helping a student understand a flashcard. "
        "Keep answers short (2-4 sentences), clear, and use a concrete example or analogy when it helps. "
        "Do not use markdown headers or bullet lists. Write in plain conversational prose."
    )
    context = f'Flashcard question: "{body.question}"\nFlashcard answer: "{body.answer}"'
    messages = []
    if body.history:
        messages.extend(body.history[-10:])
        messages.append({"role": "user", "content": body.user_question or "Explain this more."})
    else:
        opener = body.user_question or "Explain this concept in more depth so I actually understand it."
        messages.append({"role": "user", "content": f"{context}\n\n{opener}"})
    text = ask(system, messages, max_tokens=600)
    return {"explanation": text}


@app.post("/grade-answer")
@limiter.limit("30/minute")
async def grade_answer(request: Request, body: GradeRequest):
    system = (
        "You grade a student's written answer against the correct answer. "
        "Be fair: award credit for correct meaning even if the wording differs. "
        'Return ONLY valid JSON, no markdown: '
        '{"score": 0-100, "verdict": "correct" | "partial" | "incorrect", "feedback": "one or two sentences"}'
    )
    prompt = (
        f"Question: {body.question}\n"
        f"Correct answer: {body.correct_answer}\n"
        f"Student's answer: {body.user_answer}\n\nGrade it."
    )
    text = ask(system, [{"role": "user", "content": prompt}], max_tokens=400)
    result = parse_model_json(text, expect="object")
    return {"result": json.dumps(result)}


@app.post("/build-quiz")
@limiter.limit("10/minute")
async def build_quiz(request: Request, body: QuizRequest):
    cards_text = "\n".join(f"{i+1}. Q: {c.q} | A: {c.a}" for i, c in enumerate(body.cards))
    system = (
        "You convert flashcards into multiple choice quiz questions. "
        "For each card, write the question and four options where exactly one is correct. "
        "The three wrong options must be plausible and related to the topic, not obviously silly. "
        'Return ONLY a valid JSON array, no markdown: '
        '[{"q": "question", "options": ["a","b","c","d"], "correct": 0}] '
        "where correct is the zero-based index of the right option."
    )
    text = ask(
        system,
        [{"role": "user", "content": f"Convert these flashcards into quiz questions:\n\n{cards_text}"}],
        max_tokens=2500,
    )
    quiz = parse_model_json(text, expect="array")
    return {"quiz": json.dumps(quiz)}


@app.post("/analyze-weakness")
@limiter.limit("10/minute")
async def analyze_weakness(request: Request, body: WeaknessRequest):
    missed = "\n".join(f"- Q: {c.q} | A: {c.a}" for c in body.missed_cards)
    system = (
        "You analyze which flashcards a student got wrong and identify the underlying concept gaps. "
        "Then you generate extra practice cards targeting those specific gaps. "
        'Return ONLY valid JSON, no markdown: '
        '{"summary": "2-3 sentences on what the student is struggling with", '
        '"weak_topics": ["topic 1", "topic 2"], '
        '"practice_cards": [{"q": "question", "a": "answer"}]} '
        "Generate 4-6 practice cards."
    )
    prompt = f'The student missed these cards from "{body.deck_name}":\n\n{missed}\n\nAnalyze the gaps and build targeted practice.'
    text = ask(system, [{"role": "user", "content": prompt}], max_tokens=1500)
    analysis = parse_model_json(text, expect="object")
    return {"analysis": json.dumps(analysis)}


@app.post("/adapt-card")
@limiter.limit("30/minute")
async def adapt_card(request: Request, body: AdaptRequest):
    if body.direction not in ("easier", "harder"):
        raise HTTPException(status_code=400, detail="direction must be 'easier' or 'harder'")
    if body.direction == "easier":
        instruction = "Rewrite this flashcard to be easier: simpler wording, more direct recall, break down the concept."
    else:
        instruction = "Rewrite this flashcard to be harder: require application or reasoning rather than plain recall."
    system = (
        f"{instruction} Keep it on the same underlying concept. "
        'Return ONLY valid JSON, no markdown: {"q": "new question", "a": "new answer"}'
    )
    text = ask(
        system,
        [{"role": "user", "content": f"Original question: {body.question}\nOriginal answer: {body.answer}"}],
        max_tokens=500,
    )
    card = parse_model_json(text, expect="object")
    return {"card": json.dumps(card)}


@app.post("/suggest-name")
@limiter.limit("20/minute")
async def suggest_name(request: Request, body: NameRequest):
    cards_text = "\n".join(f"Q: {c.q} | A: {c.a}" for c in body.cards[:12])
    system = (
        "You read a set of flashcards and suggest a short deck name and a subject tag. "
        "The name should be 2-5 words, specific, no quotes. "
        "The topic must be one of: Science, History, Computer Science, Math, Languages, Economics, Other. "
        'Return ONLY valid JSON, no markdown: {"name": "Deck Name", "topic": "Science"}'
    )
    text = ask(
        system,
        [{"role": "user", "content": f"Suggest a name and topic for these flashcards:\n\n{cards_text}"}],
        max_tokens=200,
    )
    suggestion = parse_model_json(text, expect="object")
    return {"suggestion": json.dumps(suggestion)}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side."})
