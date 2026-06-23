 MindSync 🧠

An AI-powered flashcard generator that transforms your notes into study-ready flashcards instantly.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Claude AI](https://img.shields.io/badge/Claude_AI-D97757?style=for-the-badge&logo=anthropic&logoColor=white)

## Features

- **AI-generated flashcards** — paste any notes and get Q&A cards instantly
- **Interactive flip cards** — click to reveal answers
- **Deck management** — navigate, jump to any card, or delete cards you don't need
- **Adjustable count** — generate 5, 8, 12, or 15 cards at a time

## Tech Stack

- **Frontend:** React
- **AI:** Claude API (claude-sonnet-4-6)

## Getting Started

### Prerequisites
- Node.js
- An Anthropic API key ([get one here](https://console.anthropic.com))

### Installation

1. Clone the repo
   ```bash
   git clone https://github.com/JasmineG-07/mindsync.git
   cd mindsync
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory
   ```
   REACT_APP_API_KEY=your_api_key_here
   ```

4. Start the app
   ```bash
   npm start
   ```

## Planned Features

- [ ] FastAPI backend
- [ ] PDF upload support
- [ ] Multiple choice mode
- [ ] Score tracking and spaced repetition
- [ ] User authentication and saved decks

## License

MIT

