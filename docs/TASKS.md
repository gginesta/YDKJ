# Task Breakdown

Granular tasks organized by phase. Each task is a single unit of work.

**Last updated:** 2026-03-28 — Updated to reflect actual implementation progress.

---

## Phase 1: Foundation ✅ COMPLETE

### 1.1 Project Setup
- [x] Initialize Next.js 14 project with TypeScript (`npx create-next-app@latest`)
- [x] Configure `tsconfig.json` with strict mode and path aliases
- [x] Install and configure Tailwind CSS
- [x] Add ESLint configuration
- [x] Create `.env.example` with all required variables
- [x] Create `.gitignore` (node_modules, .env, .next, *.db)
- [x] Set up folder structure (`src/app`, `src/components`, `src/lib`, `src/types`, `docs`)

### 1.2 Custom Server for Socket.io
- [x] Create `server.ts` — custom Node HTTP server wrapping Next.js
- [x] Install `socket.io` and `socket.io-client`
- [x] Attach Socket.io to the custom HTTP server
- [x] Configure CORS for local development
- [x] Update `package.json` scripts (`dev` uses custom server)
- [x] Verify WebSocket connection from browser to server

### 1.3 Room System
- [x] Create `src/lib/game-engine/room-manager.ts`
- [x] Room code generator (4 uppercase letters, no ambiguous chars)
- [x] In-memory room store (`Map<string, GameRoom>`)
- [x] Create room endpoint / socket event
- [x] Join room by code (validate code exists, room not full, game not started)
- [x] Leave room / disconnect handling
- [x] Auto-cleanup rooms after 2 hours inactive

### 1.4 Lobby UI
- [x] Create landing page (`src/app/page.tsx`) — "Create Game" button
- [x] Create join page (`src/app/join/page.tsx`) — room code input
- [x] Create lobby view (`src/app/game/[roomId]/page.tsx`)
- [x] Display connected player list with names
- [x] "Start Game" button (visible to room creator only, requires 2+ players)
- [x] Mobile-first layout (full-width, large touch targets)
- [x] Socket.io client hook (`src/hooks/useSocket.ts`)

### 1.5 Database Setup
- [x] Install `better-sqlite3` and `@types/better-sqlite3`
- [x] Create `src/lib/db/index.ts` — database initialization and connection
- [x] Auto-create tables on first run (game_results, question_cache, player_groups)
- [x] Basic query helpers (insert game result, fetch recent results)
- [x] Player group question deduplication (SHA256 hash, seen question tracking)

---

## Phase 2: Core Game ✅ COMPLETE

### 2.1 Game State Machine
- [x] Create `src/lib/game-engine/game-engine.ts`
- [x] Define all states as TypeScript enum
- [x] Implement state transition logic with validation
- [x] Timer management per state (auto-advance after duration)
- [x] Broadcast state changes to all players via Socket.io
- [x] Create `src/types/game.ts` — shared types for game state, questions, players

### 2.2 Multiple Choice Questions (Hardcoded)
- [x] Create `src/lib/ai/seed-questions.json` — 32 sample questions for testing
- [x] Question selection logic (pick 10, avoid repeats via deduplication)
- [x] Assign values per round ($1k-$3k round 1, doubled round 2)

### 2.3 Question Flow
- [x] Server sends question to clients (answers redacted during intro)
- [x] Server reveals answer options (timer starts)
- [x] Client answer submission (sends answer index)
- [x] Server validates answer, calculates score with speed bonus
- [x] Server broadcasts results after all answered or timer expires
- [x] Track who has answered (show indicators, no answer reveal)
- [x] Handle timeout (no penalty, $0)
- [x] "Don't Be a Wimp" mode when nobody answers

### 2.4 Scoring System
- [x] Base score calculation per question type
- [x] Speed bonus formula: `baseValue * 0.5 * (timeRemaining / totalTime)`
- [x] Wrong answer penalty: -50% of base value
- [x] Streak tracking (consecutive correct answers)
- [x] Streak bonus at 5 correct: +$1,000
- [x] Perfect game bonus (10 correct): +$5,000
- [x] Round 2 value doubling

### 2.5 Game UI Components
- [x] Create `src/components/game/QuestionCard.tsx` — displays question + options
- [x] Create `src/components/game/Timer.tsx` — countdown bar
- [x] Create `src/components/game/Scoreboard.tsx` — player scores with animated counters
- [x] Create `src/components/game/RoundTransition.tsx` — "Round 2! Values doubled!"
- [x] Create `src/components/game/GameOver.tsx` — final standings
- [x] Create `src/components/game/GameStarting.tsx` — countdown with host intro
- [x] Create `src/components/game/HostDialogue.tsx` — host text display

### 2.6 Reconnection
- [x] Detect player disconnect (socket close) with conditional handling (lobby vs active game)
- [x] 30-second grace period for disconnected players during active games
- [x] On reconnect: rejoin room, remap socket ID, restore full game state via snapshot
- [x] Timeout: if disconnected >30s during active game, remove from room and notify others
- [x] Client-side session persistence (localStorage) with 2-hour TTL
- [x] Auto-reconnect on socket connect if stored session exists
- [x] Visual state support: player_disconnected/player_reconnected events update player list

### 2.7 Play Again
- [x] Post-game: "Play Again" button returns to lobby with same players
- [x] Reset scores, keep player list
- [x] Save game result to SQLite

---

## Phase 3: The Host ✅ COMPLETE

### 3.1 Claude API Integration
- [x] Install `@anthropic-ai/sdk`
- [x] Create `src/lib/ai/claude-client.ts` — API wrapper with availability check
- [x] Implement structured output via tool use for question generation
- [x] Response validation (ensure schema compliance per question)
- [x] Error handling (API errors caught, falls back to seed questions)

### 3.2 Question Generation Prompts
- [x] Create `src/lib/ai/prompts/question-generation.ts` — main generation prompt
- [x] System prompt with YDKJ writing style rules (misdirection, funny wrong answers)
- [x] Tool schema for structured question output (multiple choice with host scripts)
- [x] Include theme parameter (optional)
- [x] Include player names for personalization

### 3.3 Host Commentary Prompts
- [x] Create `src/lib/ai/prompts/host-commentary.ts`
- [x] Game intro prompt — AI generates personalized intro with player names
- [x] Per-question host scripts (correct, wrong, timeout) — generated with questions
- [x] Round transition prompt ("Values are doubled!") — AI-generated with standings
- [x] Game outro prompt (crown winner, roast loser) — AI-generated
- [x] Include dynamic context: scores, streaks, answer history

### 3.4 Open Trivia DB Integration
- [ ] _Deferred_ — Claude generates high-quality questions without needing seed facts
- [x] Curated seed bank (32 questions) serves as fallback when AI is unavailable

### 3.5 Question Pipeline Orchestration
- [x] Create `src/lib/ai/question-pipeline.ts`
- [x] Call Claude to generate 12 questions (10 + 2 backup) with validation
- [x] Validate all generated questions (structure, length, schema compliance)
- [x] Question deduplication per player group (via SQLite)
- [x] Trigger generation during GAME_STARTING state
- [x] Graceful fallback: AI → seed questions (seamless to players)

### 3.6 ElevenLabs TTS Integration
- [x] Create `src/lib/voice/elevenlabs-client.ts`
- [x] TTS function (text → base64 MP3 audio)
- [x] Voice configuration (eleven_turbo_v2, configurable via env vars)
- [x] Timeout protection (4s max — falls back to text if TTS is slow)
- [x] Audio delivered as base64 data URLs via Socket.io events

### 3.7 Client Audio Playback
- [x] Create `src/lib/audio/voice-player.ts`
- [x] Web Audio API setup for voice playback
- [x] Handle audio autoplay restrictions (AudioContext init on user gesture)
- [x] Queue system (prevents overlapping voice lines)
- [x] Text fallback always displayed (audio is an enhancement, not required)

### 3.8 Voice Integration
- [x] Audio generated for: game intro, question intros, answer reveals, round transitions, game outro
- [x] Audio sent alongside text via Socket.io events (audioUrl field)
- [x] Client auto-plays audio when received; shows text regardless
- [x] Audio stops on leave room

---

## Phase 4: Question Variety — NOT STARTED

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

## Phase 5: Power-Ups & Easter Eggs — NOT STARTED

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

## Phase 6: Audio & Visual Polish — NOT STARTED

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

## Phase 7: Deployment & Testing — NOT STARTED

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
- [x] Graceful shutdown handling

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

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Foundation | 28 | ✅ Complete |
| Phase 2: Core Game | 27 | ✅ Complete |
| Phase 3: The Host | 30 | ✅ Complete (Open Trivia DB deferred) |
| Phase 4: Question Variety | 22 | ⬜ Not started |
| Phase 5: Power-Ups & Easter Eggs | 24 | ⬜ Not started |
| Phase 6: Audio & Visual Polish | 33 | ⬜ Not started |
| Phase 7: Deployment & Testing | 22 | ⬜ 1 task done (graceful shutdown) |
| **Total** | **186 tasks** | **~50% complete** |

## MVP Shortcut

If you want to play with friends ASAP, here's the fastest path:

1. **Phase 1** — ✅ Done
2. **Phase 2** — ✅ Done (reconnection can be deferred)
3. **Phase 3** — Core only (Claude questions + ElevenLabs voice, skip Open Trivia DB integration)
4. **Phase 4** — Jack Attack only (skip DisOrDat, Gibberish, ThreeWay for now)
5. **Phase 7** — Deploy only (skip tests, skip hardening)

This gets you: **AI-hosted multiple choice + Jack Attack with voice, for 10 players, deployed.** Then layer in the remaining question types, power-ups, pixel art, and audio iteratively.

## Known Bugs Fixed (2026-03-29)

- ✅ Server now uses its own timestamp for speed bonus calculation (prevents client-side manipulation)
- ✅ Answer index validated (must be 0-3 integer)
- ✅ Player names sanitized (HTML stripped, length limited to 16 chars)
- ✅ Graceful shutdown added (closes DB, stops cleanup interval)
- ✅ Streak bonus now only counts current game answers
- ✅ Scoreboard round count no longer hardcoded
- ✅ `resetSeenQuestions` export cleaned up
- ✅ Fixed React 19 ref access during render warning in useSocket hook
- ✅ Disconnect during active game now uses grace period instead of immediate removal
