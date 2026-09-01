# MindSync

An AI-powered study platform that turns notes, documents, and slides into flashcards — then quizzes you, explains what you miss, and builds targeted practice for your weak spots.

Built with React, FastAPI, Firebase, and the Claude API.

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
npm start
```

Add your Firebase config to `src/firebase.js`.

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn anthropic python-dotenv
```

Create `backend/.env`:

```
ANTHROPIC_API_KEY=your_key_here
```

Run it:

```bash
uvicorn main:app --reload
```

The frontend expects the backend at `http://127.0.0.1:8000`.

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

## Project structure

```
mindsync/
├── src/
│   ├── App.js          # All pages and components
│   ├── firebase.js     # Auth, Firestore, class/deck helpers
│   └── index.js
├── backend/
│   ├── main.py         # FastAPI app with all AI endpoints
│   └── .env            # API key (gitignored)
├── public/
└── README.md
```

---

## Roadmap

- [ ] Deploy frontend (Vercel) and backend (Railway)
- [ ] Lecture recording to flashcards via Web Speech API
- [ ] Spaced repetition scheduling
- [ ] Unit tests and CI
- [ ] Real public deck backend (currently seeded sample data)

---

## License

MIT
