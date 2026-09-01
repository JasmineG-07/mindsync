# MindSync

[![CI](https://github.com/JasmineG-07/mindsync/actions/workflows/ci.yml/badge.svg)](https://github.com/JasmineG-07/mindsync/actions/workflows/ci.yml)

An AI-powered study platform that turns notes, documents, and slides into flashcards — then quizzes you, explains what you miss, and builds targeted practice for your weak spots.

**[Live demo](https://mindsync-nu.vercel.app)** · Built with React, FastAPI, Firebase, and the Claude API.

<img width="1455" height="703" alt="Screenshot 2026-09-01 at 4 27 46 PM" src="https://github.com/user-attachments/assets/ee655cb6-4bd0-4a49-9214-e5acb4ca6310" />

---

## Features

### Card generation
- Upload **PDF, DOCX, PPTX, TXT, PNG, JPG, or WEBP** — text is extracted client-side before anything is sent to the API
- Paste notes directly instead of uploading
- Pick how many cards to generate (presets or a custom number up to 50)
- Choose a difficulty level that changes how the AI writes questions:
  - **Beginner** — definitions and direct recall
  - **Intermediate** — recall plus understanding
  - **Advanced** — application and reasoning

### Review before saving
Generated cards land in a review screen first. For each card you can:
- Approve it
- Rewrite the question or answer inline
- Delete it
- Ask the AI for an easier or harder version of the same concept

Nothing is saved until you confirm.

### AI study tools
| Feature | What it does |
|---|---|
| AI tutor | Opens a chat on any card with a plain-language explanation, then answers follow-up questions with full conversation context |
| Quiz mode | Converts a deck into multiple choice (AI writes plausible distractors) or written answers |
| Answer grading | Grades written answers 0–100 with a verdict and feedback, awarding partial credit for correct meaning with different wording |
| Weak spot detection | After a quiz, analyzes missed cards, names the underlying concept gaps, and generates 4–6 targeted practice cards |
| Adaptive difficulty | Rewrites any card easier or harder while keeping the same concept |
| Auto naming | Suggests a deck name and subject tag from the card contents |

### Decks and classes
- Save decks to your account (Firestore)
- Build a custom deck by hand, no AI involved
- Export any deck as **CSV** or **JSON**
- Browse public decks by topic with search and filters
- **Classes** — create a class, get a short join code (e.g. `CIS-4X7K`), and share decks with everyone in it
- Copy a class deck into your own account
- Daily streak tracking

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 |
| Backend | FastAPI (Python) |
| AI | Claude API (`claude-sonnet-4-6`) |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore |
| File parsing | pdfjs-dist, mammoth, JSZip |

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   React     │────▶│   FastAPI    │────▶│  Claude API │
│  frontend   │◀────│   backend    │◀────│             │
└─────────────┘     └──────────────┘     └─────────────┘
       │
       │  auth + persistence
       ▼
┌─────────────────────────┐
│  Firebase Auth          │
│  Cloud Firestore        │
└─────────────────────────┘
```

The API key lives only in the backend `.env` and is never exposed to the browser. File text extraction happens client-side to keep payloads small.

---

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/generate` | Generate flashcards from text at a given difficulty |
| `POST` | `/generate-from-image` | Generate flashcards from an image |
| `POST` | `/explain-card` | AI tutor explanation with conversation history |
| `POST` | `/grade-answer` | Grade a written answer with score and feedback |
| `POST` | `/build-quiz` | Convert flashcards into multiple choice questions |
| `POST` | `/analyze-weakness` | Analyze missed cards and generate targeted practice |
| `POST` | `/adapt-card` | Rewrite a card easier or harder |
| `POST` | `/suggest-name` | Suggest a deck name and subject tag |

---

## Getting started

### Prerequisites
- Node.js 16+
- Python 3.9+
- An [Anthropic API key](https://console.anthropic.com)
- A [Firebase project](https://console.firebase.google.com) with Authentication and Firestore enabled

### Frontend

```bash
git clone https://github.com/JasmineG-07/mindsync.git
cd mindsync
npm install
```

Create `.env` in the project root:

```
REACT_APP_API_URL=http://127.0.0.1:8000
```

Add your Firebase config to `src/firebase.js`, then:

```bash
npm start
```

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
ANTHROPIC_API_KEY=your_key_here
ALLOWED_ORIGINS=http://localhost:3000
```

Run it:

```bash
uvicorn main:app --reload
```

The frontend reads the backend URL from `REACT_APP_API_URL`, defaulting to `http://127.0.0.1:8000`.

### Firebase setup

1. Enable **Google** under Authentication → Sign-in method
2. Create a **Cloud Firestore** database
3. Publish these security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /decks/{deckId} {
      allow read, delete: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
    }
    match /classes/{classId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.ownerId == request.auth.uid;
      allow update: if request.auth != null;
      allow delete: if request.auth != null && resource.data.ownerId == request.auth.uid;
    }
    match /classDecks/{deckId} {
      allow read, create: if request.auth != null;
      allow delete: if request.auth != null && resource.data.authorId == request.auth.uid;
    }
  }
}
```

Users can only read and delete their own decks. Class content is readable by signed-in members, and shared decks can only be deleted by their author.

---

## Testing

41 tests across the stack, run automatically on every push via GitHub Actions.

### Backend (22 tests, pytest)

```bash
cd backend
pip install pytest httpx
pytest -v
```

The Anthropic client is mocked, so tests run without an API key or network access. Coverage includes happy paths for every endpoint, input validation, markdown-fence stripping, malformed model output, conversation history truncation, and error mapping (missing key → 503, upstream rate limit → 429).

### Frontend (19 tests, React Testing Library)

```bash
npm test
```

Firebase and the file-parsing libraries are mocked. Coverage includes the auth gate, navigation between all five pages, Explore search filtering, the full generate → review → save flow, error surfacing, retry behaviour, and streak persistence.

---

## Error handling

Failures are classified rather than swallowed into a generic message.

The backend maps SDK exceptions onto meaningful status codes:

| Condition | Status | What the user sees |
|---|---|---|
| No API key configured | 503 | "The AI service is not configured" |
| Upstream rate limit | 429 | "Rate limited, wait a moment" |
| Account out of credits | 402 | "The AI account has no credits left" |
| Model returned invalid JSON | 502 | "Malformed response, try again" |
| Network failure to Anthropic | 504 | "Could not reach the AI service" |

The frontend retries transient failures (429, 5xx, network errors) with exponential backoff, and fails fast on errors that will not resolve on retry (400, 402). Every message shown to the user comes from the server's `detail` field where one exists.

### Rate limiting

Per-IP limits via `slowapi` so a public deployment cannot burn through API credits:

| Endpoint group | Limit |
|---|---|
| `/generate`, `/suggest-name` | 20/min |
| `/generate-from-image`, `/build-quiz`, `/analyze-weakness` | 10/min |
| `/explain-card`, `/grade-answer`, `/adapt-card` | 30/min |

Request payloads are also bounded — notes cap at 100,000 characters, card counts at 50, and image media types are allowlisted.

---

## Deployment

The frontend is on Vercel and the backend on Railway.

### Backend (Railway)

1. Create a new project from the GitHub repo, root directory `backend`
2. Set environment variables:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ALLOWED_ORIGINS=https://your-frontend.vercel.app
   ```
3. Railway detects the `Procfile` and runs `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Frontend (Vercel)

1. Import the repo, framework preset Create React App
2. Set environment variable:
   ```
   REACT_APP_API_URL=https://your-backend.up.railway.app
   ```
3. Add the Vercel domain to Firebase → Authentication → Settings → Authorized domains

Both platforms redeploy automatically on push to `main`.

---

## Project structure

```
mindsync/
├── .github/
│   └── workflows/
│       └── ci.yml           # Runs both test suites on every push
├── src/
│   ├── App.js               # All pages and components
│   ├── App.test.js          # Frontend tests
│   ├── firebase.js          # Auth, Firestore, class/deck helpers
│   └── index.js
├── backend/
│   ├── main.py              # FastAPI app with all AI endpoints
│   ├── test_main.py         # Backend tests
│   ├── requirements.txt
│   ├── Procfile             # Railway start command
│   └── .env                 # API key (gitignored)
├── vercel.json
├── .env                     # REACT_APP_API_URL (gitignored)
└── README.md
```

---

## Roadmap

- [x] Deploy frontend (Vercel) and backend (Railway)
- [x] Test suite and CI pipeline
- [x] Rate limiting and structured error handling
- [ ] Lecture recording to flashcards via Web Speech API
- [ ] Spaced repetition scheduling
- [ ] Public deck sharing — let users publish their own decks to the Explore page

---

## License

MIT
