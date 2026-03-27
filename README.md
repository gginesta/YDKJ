# YDKJ - You Don't Know Jack (Web Edition)

A multiplayer trivia game inspired by "You Don't Know Jack" — where high culture and pop culture collide. Built for the web, played with friends, and hosted by an AI with attitude.

## What Is This?

A browser-based, real-time multiplayer trivia game for up to 10 players. The star of the show is an AI-powered host with a fixed personality who reads questions aloud (via ElevenLabs TTS), roasts players by name, and generates all game content on the fly.

Players join via room codes on their phones — no accounts needed. Games last 15-20 minutes with structured rounds, a variety of question types, and a fast-paced Jack Attack finale.

## Key Features

- **AI Host with Voice** — A single, memorable character who drives the comedy. Calls out players by name, mocks the losers, hypes the winners.
- **Variety of Question Types** — Multiple choice, DisOrDat, Gibberish Questions, ThreeWay, and Jack Attack finale.
- **Catch-Up Power-Ups** — Trailing players earn power-ups to stay competitive (steal time, add fake answers, point theft).
- **Full Audio Design** — Background music, SFX, transitions, and ElevenLabs voice.
- **Retro Pixel Art UI** — Nostalgic aesthetic with smooth animations.
- **Hidden Easter Eggs** — Wrong Answer of the Game and expanded secret bonuses throughout.
- **Mobile-First** — Designed for phones, works on any screen.
- **No Auth Required** — Room codes to join, light game history tracking.

## Documentation

- [Architecture & Technical Design](./docs/ARCHITECTURE.md)
- [Game Design Document](./docs/GAME_DESIGN.md)
- [Roadmap & Phases](./docs/ROADMAP.md)
- [Task Breakdown](./docs/TASKS.md)
- [AI & Voice Pipeline](./docs/AI_PIPELINE.md)

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14 + TypeScript | App router, SSR, API routes, great DX |
| Styling | Tailwind CSS + custom pixel theme | Rapid styling with retro customization |
| Real-time | Socket.io (WebSockets) | Proven, handles reconnection, rooms built-in |
| Backend | Next.js API routes + Socket.io server | Single deployment, shared types |
| AI | Claude API (Anthropic) | Best for creative writing, humor, question generation |
| Voice | ElevenLabs TTS API | High-quality, low-latency voice synthesis |
| Database | SQLite (via better-sqlite3) | Zero-config, perfect for light persistence |
| Deployment | Railway | WebSocket support, easy deploys, affordable |

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your ANTHROPIC_API_KEY and ELEVENLABS_API_KEY

# Run development server
npm run dev

# Open http://localhost:3000
```

## Project Structure

```
ydkj/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── page.tsx            # Landing / create game
│   │   ├── join/page.tsx       # Join via room code
│   │   ├── game/[roomId]/      # Game play screen
│   │   └── api/                # API routes
│   ├── components/             # React components
│   │   ├── game/               # Game UI components
│   │   ├── host/               # Host display & animations
│   │   ├── questions/          # Question type renderers
│   │   ├── lobby/              # Lobby & room code UI
│   │   ├── powerups/           # Power-up shop UI
│   │   └── ui/                 # Shared pixel-art UI primitives
│   ├── lib/                    # Core logic
│   │   ├── game-engine/        # Server-side game state machine
│   │   ├── ai/                 # AI prompt templates & generation
│   │   ├── voice/              # ElevenLabs client wrapper
│   │   ├── audio/              # Audio manager (SFX + music)
│   │   ├── socket/             # Socket.io client & server setup
│   │   └── db/                 # SQLite schema & queries
│   ├── types/                  # Shared TypeScript types
│   └── assets/                 # Static assets
├── docs/                       # Project documentation
├── public/                     # Public static files
└── ...config files
```

## License

Private project — not open source.
