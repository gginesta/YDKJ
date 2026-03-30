# YDKJ - You Don't Know Jack (Web Edition)

A multiplayer trivia game inspired by "You Don't Know Jack" -- where high culture and pop culture collide. Built for the web, played with friends, and hosted by an AI with attitude.

## What Is This?

A browser-based, real-time multiplayer trivia game for up to 10 players. The star of the show is an AI-powered host with a fixed personality who reads questions aloud (via ElevenLabs TTS), roasts players by name, and generates game content on the fly.

Players join via room codes on their phones -- no accounts needed. Games last 15-20 minutes with structured rounds and a variety of question types.

## Current Status

**Phases 1-3 Complete. Deployed on Railway.**

The game is playable end-to-end:
- 200 hand-written seed questions with YDKJ-style humor
- AI question generation via Claude (Open Trivia DB seeds -> YDKJ rewrite)
- AI host commentary (personalized, uses player names and scores)
- ElevenLabs TTS voice with two-tier audio system
- Player group dedup tracking (same friends never see repeat questions)
- Real-time multiplayer via Socket.io
- Deployed and accessible via Railway URL

## Key Features

### Working Now
- **AI Host with Voice** -- A sarcastic, witty host who calls out players by name. Two-tier audio: pre-generated for instant playback + live AI reactions as bonus.
- **200 Seed Questions** -- Hand-written, factually verified, across 26 categories with balanced answer distribution.
- **AI Question Generation** -- Claude transforms Open Trivia DB facts into YDKJ-style questions with comedy framing, misdirection, and plausible wrong answers.
- **Smart Dedup** -- Per player group tracking. Same friends can play 20+ games before seeing any repeats.
- **Mobile-First** -- Designed for phones, works on any screen.
- **No Auth Required** -- Room codes to join, light game history tracking.

### Planned (Not Yet Built)
- **Additional Question Types** -- DisOrDat, Gibberish, ThreeWay, Jack Attack finale.
- **Catch-Up Power-Ups** -- Trailing players earn power-ups to stay competitive.
- **Visual Polish** -- Pixel art theme, animations, SFX.
- **Easter Eggs** -- Wrong Answer of the Game and hidden bonuses.

## Documentation

- [Architecture & Technical Design](./docs/ARCHITECTURE.md)
- [Game Design Document](./docs/GAME_DESIGN.md)
- [Roadmap & Phases](./docs/ROADMAP.md)
- [Task Breakdown](./docs/TASKS.md)
- [AI & Voice Pipeline](./docs/AI_PIPELINE.md)

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 16 + TypeScript | App router, SSR, shared types |
| Styling | Tailwind CSS 4 | Rapid styling with custom theme |
| State | Zustand | Lightweight client-side store |
| Real-time | Socket.io (WebSockets) | Proven, handles reconnection, rooms built-in |
| AI (Questions) | Claude API (Anthropic) | Best for creative writing, humor, question generation |
| AI (Voice) | ElevenLabs TTS | High-quality, low-latency voice synthesis |
| Database | SQLite (via better-sqlite3) | Zero-config, perfect for light persistence |
| Deployment | Railway | WebSocket support, easy deploys, affordable |

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your ANTHROPIC_API_KEY and ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID

# Run development server
npm run dev

# Open http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Optional | Claude API key for AI question generation + host commentary |
| `ELEVENLABS_API_KEY` | Optional | ElevenLabs API key for TTS voice synthesis |
| `ELEVENLABS_VOICE_ID` | Optional | ElevenLabs voice ID (default: `1t1EeRixsJrKbiF1zwM6`) |
| `DATABASE_PATH` | Optional | SQLite DB path (default: `./ydkj.db`, set to `/data/ydkj.db` on Railway) |

Without API keys, the game runs on 200 seed questions with static text host scripts. All AI/voice features are optional enhancements.

## Project Structure

```
ydkj/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── page.tsx            # Landing / create game
│   │   ├── join/page.tsx       # Join via room code
│   │   └── game/[roomId]/      # Game play screen
│   ├── components/game/        # Game UI components
│   │   ├── QuestionCard.tsx    # Question display + answer cards
│   │   ├── GameStarting.tsx    # Loading screen with progress bar
│   │   ├── Scoreboard.tsx      # Score display
│   │   ├── GameOver.tsx        # Final standings
│   │   ├── Timer.tsx           # Countdown bar
│   │   ├── HostDialogue.tsx    # Host text display
│   │   └── RoundTransition.tsx # Round 2 announcement
│   ├── hooks/
│   │   └── useSocket.ts        # Socket.io client + audio playback
│   ├── stores/
│   │   └── gameStore.ts        # Zustand game state
│   ├── lib/
│   │   ├── game-engine/        # Server-side game state machine
│   │   │   ├── game-engine.ts  # Core engine (phases, scoring, audio cache)
│   │   │   ├── room-manager.ts # Room CRUD + cleanup
│   │   │   └── scoring.ts      # Score calculation
│   │   ├── ai/                 # AI pipeline
│   │   │   ├── claude-client.ts          # Anthropic SDK wrapper
│   │   │   ├── trivia-api.ts             # Open Trivia DB client
│   │   │   ├── question-pipeline.ts      # Orchestrator (seeds -> Claude -> validate)
│   │   │   ├── host-commentary-service.ts # AI host text + voice generation
│   │   │   ├── seed-questions.json       # 200 hand-written questions
│   │   │   └── prompts/                  # Prompt templates
│   │   │       ├── question-generation.ts # "Creative bible" for YDKJ style
│   │   │       └── host-commentary.ts     # Host personality + game context
│   │   ├── voice/              # ElevenLabs integration
│   │   │   ├── elevenlabs-client.ts # TTS API client
│   │   │   └── audio-cache.ts       # Tier 1 batch pre-generation
│   │   ├── socket/
│   │   │   └── server.ts       # Socket.io server setup
│   │   └── db/
│   │       └── index.ts        # SQLite schema + queries + dedup
│   └── types/                  # Shared TypeScript types
├── docs/                       # Project documentation
├── server.ts                   # Custom HTTP/Socket.io server
├── Dockerfile                  # Multi-stage Railway deployment
└── railway.toml                # Railway config
```

## License

Private project -- not open source.
