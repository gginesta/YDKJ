# Task Breakdown

Granular tasks organized by phase. Each task is a single unit of work.

---

## Phase 1: Foundation

### 1.1 Project Setup
- [ ] Initialize Next.js 14 project with TypeScript (`npx create-next-app@latest`)
- [ ] Configure `tsconfig.json` with strict mode and path aliases
- [ ] Install and configure Tailwind CSS
- [ ] Add ESLint + Prettier configuration
- [ ] Create `.env.example` with all required variables
- [ ] Create `.gitignore` (node_modules, .env, .next, *.db)
- [ ] Set up folder structure (`src/app`, `src/components`, `src/lib`, `src/types`, `docs`)

### 1.2 Custom Server for Socket.io
- [ ] Create `server.ts` — custom Node HTTP server wrapping Next.js
- [ ] Install `socket.io` and `socket.io-client`
- [ ] Attach Socket.io to the custom HTTP server
- [ ] Configure CORS for local development
- [ ] Update `package.json` scripts (`dev` uses custom server)
- [ ] Verify WebSocket connection from browser to server

### 1.3 Room System
- [ ] Create `src/lib/game-engine/room-manager.ts`
- [ ] Room code generator (4 uppercase letters, no ambiguous chars)
- [ ] In-memory room store (`Map<string, GameRoom>`)
- [ ] Create room endpoint / socket event
- [ ] Join room by code (validate code exists, room not full, game not started)
- [ ] Leave room / disconnect handling
- [ ] Auto-cleanup rooms after 2 hours inactive

### 1.4 Lobby UI
- [ ] Create landing page (`src/app/page.tsx`) — "Create Game" button
- [ ] Create join page (`src/app/join/page.tsx`) — room code input
- [ ] Create lobby view (`src/app/game/[roomId]/page.tsx`)
- [ ] Display connected player list with names
- [ ] "Start Game" button (visible to room creator only, requires 2+ players)
- [ ] Mobile-first layout (full-width, large touch targets)
- [ ] Socket.io client hook (`src/lib/socket/useSocket.ts`)

### 1.5 Database Setup
- [ ] Install `better-sqlite3` and `@types/better-sqlite3`
- [ ] Create `src/lib/db/schema.sql` (game_results, question_cache tables)
- [ ] Create `src/lib/db/index.ts` — database initialization and connection
- [ ] Auto-create tables on first run
- [ ] Basic query helpers (insert game result, fetch recent results)

---

## Phase 2: Core Game

### 2.1 Game State Machine
- [ ] Create `src/lib/game-engine/state-machine.ts`
- [ ] Define all states as TypeScript enum
- [ ] Implement state transition logic with validation
- [ ] Timer management per state (auto-advance after duration)
- [ ] Broadcast state changes to all players via Socket.io
- [ ] Create `src/types/game.ts` — shared types for game state, questions, players

### 2.2 Multiple Choice Questions (Hardcoded)
- [ ] Create `src/lib/ai/seed-questions.json` — 30+ sample questions for testing
- [ ] Question selection logic (pick 10, avoid repeats)
- [ ] Assign values per round ($1k-$3k round 1, doubled round 2)

### 2.3 Question Flow
- [ ] Server sends question to clients (answers redacted during intro)
- [ ] Server reveals answer options (timer starts)
- [ ] Client answer submission (sends answer index + timestamp)
- [ ] Server validates answer, calculates score with speed bonus
- [ ] Server broadcasts results after all answered or timer expires
- [ ] Track who has answered (show indicators, no answer reveal)
- [ ] Handle timeout (no penalty, $0)

### 2.4 Scoring System
- [ ] Base score calculation per question type
- [ ] Speed bonus formula: `baseValue * 0.5 * (timeRemaining / totalTime)`
- [ ] Wrong answer penalty: -50% of base value
- [ ] Streak tracking (consecutive correct answers)
- [ ] Streak bonus at 5 correct: +$1,000
- [ ] Round 2 value doubling

### 2.5 Game UI Components
- [ ] Create `src/components/game/QuestionCard.tsx` — displays question + options
- [ ] Create `src/components/game/Timer.tsx` — countdown bar
- [ ] Create `src/components/game/Scoreboard.tsx` — player scores
- [ ] Create `src/components/game/AnswerReveal.tsx` — correct/wrong feedback
- [ ] Create `src/components/game/RoundTransition.tsx` — "Round 2! Values doubled!"
- [ ] Create `src/components/game/GameOver.tsx` — final standings

### 2.6 Reconnection
- [ ] Detect player disconnect (socket close)
- [ ] Mark player as disconnected (don't remove from game)
- [ ] On reconnect: rejoin room, restore state, sync to current question
- [ ] Timeout: if disconnected >60s during active game, auto-skip their answers

### 2.7 Play Again
- [ ] Post-game: "Play Again" button returns to lobby with same players
- [ ] Reset scores, keep player list
- [ ] Save game result to SQLite

---

## Phase 3: The Host

### 3.1 Claude API Integration
- [ ] Install `@anthropic-ai/sdk`
- [ ] Create `src/lib/ai/claude-client.ts` — API wrapper
- [ ] Implement structured output via tool use for question generation
- [ ] Response validation (ensure schema compliance)
- [ ] Retry logic (1 retry on parse failure)
- [ ] Error handling (timeout, rate limit, bad response)

### 3.2 Question Generation Prompts
- [ ] Create `src/lib/ai/prompts/question-generation.ts` — main generation prompt
- [ ] System prompt with YDKJ writing style rules
- [ ] Tool schema for structured question output (all 5 types)
- [ ] Include theme parameter (optional)
- [ ] Include player names for personalization
- [ ] Test prompt quality — iterate until questions are genuinely funny

### 3.3 Host Commentary Prompts
- [ ] Create `src/lib/ai/prompts/host-commentary.ts`
- [ ] Game intro prompt (greet players by name, set the tone)
- [ ] Per-question reaction prompt (correct, wrong, timeout variants)
- [ ] Transition commentary prompt (between questions)
- [ ] Round transition prompt ("Values are doubled!")
- [ ] Game outro prompt (crown winner, roast loser)
- [ ] Include dynamic context: scores, streaks, answer history, power-ups

### 3.4 Open Trivia DB Integration
- [ ] Create `src/lib/ai/trivia-api.ts`
- [ ] Fetch questions from Open Trivia DB API
- [ ] Parse and normalize response format
- [ ] Use as seed facts for Claude to riff on
- [ ] Fallback if API is down (use curated seeds)

### 3.5 Question Pipeline Orchestration
- [ ] Create `src/lib/ai/question-pipeline.ts`
- [ ] Fetch seed data (Open Trivia DB + curated bank)
- [ ] Call Claude to generate 12 questions (10 + 2 backup)
- [ ] Validate all generated questions
- [ ] Cache in SQLite (7-day TTL, dedup per player group)
- [ ] Trigger generation during GAME_STARTING state
- [ ] Background generation: don't block game start

### 3.6 ElevenLabs TTS Integration
- [ ] Create `src/lib/voice/elevenlabs-client.ts`
- [ ] Streaming TTS function (text → audio stream)
- [ ] Voice selection and configuration
- [ ] Audio format: MP3 44.1kHz 128kbps
- [ ] Create `src/app/api/voice/tts/route.ts` — TTS proxy endpoint
- [ ] Server-side audio caching (avoid re-generating same lines)

### 3.7 Client Audio Playback
- [ ] Create `src/lib/audio/voice-player.ts`
- [ ] Web Audio API setup for voice playback
- [ ] Handle audio autoplay restrictions (require user gesture)
- [ ] Queue system (don't overlap voice lines)
- [ ] Text fallback display while voice loads or if voice fails

### 3.8 Voice Pre-Buffering
- [ ] Generate next question's host intro during current question's reveal phase
- [ ] Buffer audio on client before it's needed
- [ ] Track buffer state (loading, ready, playing, done)
- [ ] Sync state transitions to voice completion

---

## Phase 4: Question Variety

### 4.1 DisOrDat
- [ ] Create `src/components/questions/DisOrDat.tsx`
- [ ] UI: two category labels at top, item appears in center
- [ ] Swipe left/right or tap category to sort
- [ ] 7 items shown one at a time (5s each)
- [ ] All players compete simultaneously
- [ ] Scoring: question value / 7 per correct item
- [ ] Results shown after all 7 items
- [ ] AI prompt for generating plausible category pairs

### 4.2 Gibberish Questions
- [ ] Create `src/components/questions/Gibberish.tsx`
- [ ] UI: garbled phrase displayed prominently
- [ ] Host voice reads the garbled phrase aloud (critical)
- [ ] 4 multiple choice options for the real phrase
- [ ] Hint appears after 10 seconds
- [ ] AI prompt for generating phonetically similar garbled versions
- [ ] Test TTS pronunciation of garbled phrases

### 4.3 ThreeWay
- [ ] Create `src/components/questions/ThreeWay.tsx`
- [ ] UI: prompt word at top, 3 options cycle/highlight below
- [ ] Options highlight one at a time (3s each), 3 full cycles
- [ ] Players buzz in when correct one is highlighted
- [ ] Server validates timing (was correct option highlighted at buzz time?)
- [ ] AI prompt for word-association triples

### 4.4 Jack Attack
- [ ] Create `src/components/questions/JackAttack.tsx`
- [ ] UI: theme banner at top, clue word in center, answer words fly in/out
- [ ] Server controls word timing (sends word_active events)
- [ ] Each word visible for ~3 seconds
- [ ] Players buzz in when they see a match
- [ ] Latency compensation (±200ms tolerance window)
- [ ] +$2,000 correct buzz, -$2,000 wrong buzz
- [ ] Scores hidden during round
- [ ] ~15 words shown, ~5 are correct matches
- [ ] Dramatic reveal of Jack Attack scores at end
- [ ] AI prompt for theme, clue, and word pairs

### 4.5 Question Type Integration
- [ ] Update game state machine to handle different question types
- [ ] Question type rotation per game (structured order from GAME_DESIGN.md)
- [ ] Update AI generation prompt to produce all types in one batch
- [ ] Ensure each type has proper host intro/reaction scripts

---

## Phase 5: Power-Ups & Easter Eggs

### 5.1 Power-Up Engine
- [ ] Create `src/lib/game-engine/powerups.ts`
- [ ] Power-up granting logic (bottom 2 players every 3 questions)
- [ ] Additional grant for players >$5,000 behind leader
- [ ] Max 3 power-ups per player
- [ ] Random selection from power-up pool

### 5.2 Individual Power-Ups
- [ ] **Time Steal:** server reduces opponents' timer by 5 seconds
- [ ] **Double Down:** flag on player, 2x score calculation on next correct
- [ ] **Fake Answer:** server injects 5th AI-generated option for opponents
- [ ] **Point Leech:** if correct, steal 10% of leader's money
- [ ] **Immunity:** flag on player, no penalty for wrong answer
- [ ] **Reveal:** server sends "eliminated option" to that player only

### 5.3 Power-Up UI
- [ ] Create `src/components/powerups/PowerUpBar.tsx` — bottom of screen
- [ ] Create `src/components/powerups/PowerUpIcon.tsx` — pixel art icons
- [ ] Tap to activate (only during QUESTION_INTRO or QUESTION_ACTIVE)
- [ ] Activation animation (per power-up type)
- [ ] Notification: all players see "[Player] used [Power-Up]!"
- [ ] Host commentary on power-up usage

### 5.4 Easter Egg System
- [ ] Create `src/lib/game-engine/easter-eggs.ts`
- [ ] Wrong Answer of the Game: designate 1 per game during generation
- [ ] AI embeds subtle hint in host intro for that question
- [ ] Speed Demon: track answer times, trigger at 3 under 3 seconds
- [ ] Category Sweep: track per-category accuracy
- [ ] Last to First: detect rank change within a round
- [ ] The Contrarian: detect all-wrong in a round
- [ ] Easter egg discovery: special animation + host reaction + bonus
- [ ] Post-game Easter egg reveal section

---

## Phase 6: Audio & Visual Polish

### 6.1 Pixel Art Theme
- [ ] Install "Press Start 2P" font (Google Fonts)
- [ ] Configure Tailwind theme: colors (dark bg, neon accents), fonts, spacing
- [ ] Create pixel art button component (`src/components/ui/PixelButton.tsx`)
- [ ] Create pixel art card component (`src/components/ui/PixelCard.tsx`)
- [ ] Create pixel art input component (`src/components/ui/PixelInput.tsx`)
- [ ] CRT scanline overlay effect (CSS, toggleable)
- [ ] Dark purple/navy background with subtle grid pattern

### 6.2 Host Avatar
- [ ] Design pixel art host character (multiple expressions)
- [ ] Idle animation (subtle bounce/blink)
- [ ] Reaction animations: happy, disappointed, excited, sarcastic, shocked
- [ ] Trigger animations based on game events
- [ ] Display alongside host text/voice

### 6.3 Game Animations
- [ ] Install Framer Motion
- [ ] Question card slide-in transition
- [ ] Answer option entrance animation (staggered)
- [ ] Correct answer: green flash + pixel confetti particles
- [ ] Wrong answer: red screen shake + pixel skull
- [ ] Score counter: arcade-style number roll
- [ ] Timer: pixel segments that drain with color change (green → yellow → red)
- [ ] Jack Attack word zoom in/out animation
- [ ] Power-up activation full-screen effect
- [ ] Easter egg discovery celebration
- [ ] Round transition dramatic wipe
- [ ] Game over: winner spotlight, scores rain down

### 6.4 Audio System
- [ ] Create `src/lib/audio/audio-manager.ts` — central audio controller
- [ ] Separate volume channels: music, SFX, voice
- [ ] Volume controls accessible during game
- [ ] Handle Web Audio API context (user gesture requirement)
- [ ] Crossfade between music tracks

### 6.5 Music & SFX Assets
- [ ] Source/create chiptune tracks:
  - [ ] Lobby waiting loop
  - [ ] Game intro fanfare
  - [ ] Question thinking loop (medium tension)
  - [ ] Last 5 seconds (accelerated tension)
  - [ ] Round transition bridge
  - [ ] Jack Attack fast-paced track
  - [ ] Victory fanfare
  - [ ] Game over (loser version)
- [ ] Source/create SFX:
  - [ ] Button tap
  - [ ] Correct answer sting
  - [ ] Wrong answer sting
  - [ ] Timer tick (final 5 seconds)
  - [ ] Buzz-in sound
  - [ ] Power-up activation (unique per type)
  - [ ] Score counting up/down
  - [ ] Player join lobby
  - [ ] Easter egg jingle

### 6.6 Mobile Optimization
- [ ] Test and fix iOS Safari viewport issues (100vh, notch)
- [ ] Ensure all touch targets are ≥48px
- [ ] Optimize animations for 60fps on mid-range phones
- [ ] Test landscape and portrait orientations
- [ ] Handle keyboard avoidance (room code input)

---

## Phase 7: Deployment & Testing

### 7.1 Railway Deployment
- [ ] Create `Dockerfile` (Node.js, build Next.js, run custom server)
- [ ] Create `railway.toml` or configure via dashboard
- [ ] Set up persistent volume for SQLite database file
- [ ] Configure environment variables (API keys, etc.)
- [ ] Test deployment with WebSocket connectivity
- [ ] Set up custom domain (optional)

### 7.2 Production Hardening
- [ ] Rate limiting on all API routes
- [ ] Room cleanup cron (delete inactive rooms)
- [ ] Memory leak prevention (room/player cleanup on disconnect)
- [ ] WebSocket connection limit per IP
- [ ] Error logging to stdout (Railway captures this)
- [ ] Graceful shutdown handling

### 7.3 Testing
- [ ] Unit tests: game state machine transitions
- [ ] Unit tests: scoring calculations (speed bonus, streaks, power-ups)
- [ ] Unit tests: room management (create, join, leave, cleanup)
- [ ] Unit tests: Easter egg detection logic
- [ ] Integration tests: Socket.io event flow (join → play → game over)
- [ ] Integration tests: AI question generation (mock Claude API)
- [ ] Manual playtest: 2 players minimum flow
- [ ] Manual playtest: 10 players maximum load
- [ ] Manual playtest: all 5 question types
- [ ] Manual playtest: power-up usage in competitive game
- [ ] Device testing: iOS Safari, Android Chrome, desktop Chrome/Firefox

### 7.4 Balance & Tuning
- [ ] Tune question timing per type (is 20s enough? too much?)
- [ ] Tune power-up frequency and strength
- [ ] Tune Jack Attack word display duration
- [ ] Tune speed bonus curve (linear vs. exponential)
- [ ] Tune host commentary length (too long = boring, too short = no personality)
- [ ] Adjust AI prompts based on real gameplay feedback
- [ ] Verify cost per game stays within budget

---

## Dependencies Between Phases

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
                           │            │
                           ▼            ▼
                        Phase 5 ◄───────┘
                           │
                           ▼
                        Phase 6
                           │
                           ▼
                        Phase 7
```

- Phase 1 must complete before Phase 2 (need infrastructure)
- Phase 2 must complete before Phase 3 (need game flow for host to plug into)
- Phase 3 must complete before Phase 4 (need AI pipeline for new question types)
- Phase 5 depends on Phase 3 (host commentary) and Phase 4 (all question types)
- Phase 6 can partially overlap with Phase 5 (UI work is independent of game logic)
- Phase 7 requires all other phases complete

---

## Task Count Summary

| Phase | Tasks |
|-------|-------|
| Phase 1: Foundation | 28 |
| Phase 2: Core Game | 27 |
| Phase 3: The Host | 30 |
| Phase 4: Question Variety | 22 |
| Phase 5: Power-Ups & Easter Eggs | 24 |
| Phase 6: Audio & Visual Polish | 33 |
| Phase 7: Deployment & Testing | 22 |
| **Total** | **186 tasks** |
