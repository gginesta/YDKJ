# Development Roadmap

## Phase Overview

| Phase | Name | Status | Goal |
|-------|------|--------|------|
| 1 | Foundation | ✅ Complete | Project setup, core infrastructure, basic game flow |
| 2 | Core Game | ✅ Complete | Multiple choice working end-to-end with scoring |
| 3 | The Host | ✅ Complete | AI question generation + voice + two-tier audio |
| 4 | Question Variety | ✅ Complete | DisOrDat, Gibberish, ThreeWay, Jack Attack |
| 5 | Power-Ups & Polish | ❌ Not started | Catch-up mechanics, Easter eggs, animations |
| 6 | Audio & Visual Polish | 🔨 Partial | SFX + browser TTS done; pixel art, animations, background music TBD |
| 7 | Deployment & Testing | 🔨 Partial | Railway deployed, playtesting in progress |

**Total estimated: 8-14 weeks** (depending on pace)

---

## Phase 1: Foundation

**Goal:** Skeleton app running with real-time multiplayer connectivity.

### Deliverables
- [ ] Next.js 14 project initialized with TypeScript
- [ ] Tailwind CSS configured with pixel art theme basics
- [ ] Socket.io server integrated with Next.js (custom server)
- [ ] Room creation with 4-letter codes
- [ ] Player join/leave flow
- [ ] Lobby UI (mobile-first) showing connected players
- [ ] Basic game state machine (lobby → playing → game over)
- [ ] SQLite database setup with schema
- [ ] Environment variable configuration (.env.example)
- [ ] Development tooling (ESLint, Prettier)

### Key Decisions
- Custom Next.js server needed for Socket.io (can't use default serverless)
- Room codes: 4 uppercase letters, excluding ambiguous chars (O/0, I/1, L)
- State machine library: `xstate` v5 or custom (evaluate complexity)

### Technical Risks
- Socket.io + Next.js App Router integration can be tricky
- Need custom server.ts to attach Socket.io to the HTTP server

---

## Phase 2: Core Game

**Goal:** Play a complete game of multiple choice trivia with scoring.

### Deliverables
- [ ] Game state machine: full flow from lobby to game over
- [ ] Multiple choice question display (mobile-optimized)
- [ ] Answer submission with timing tracking
- [ ] Server-side answer validation
- [ ] Money-based scoring with speed bonuses
- [ ] Score display with basic animations
- [ ] Timer countdown UI (per question)
- [ ] Round 1 → Round 2 transition (doubled values)
- [ ] Game over screen with final standings
- [ ] Hardcoded sample questions (for testing without AI)
- [ ] Basic reconnection handling (player phone sleeps)
- [ ] Play again flow

### Key Decisions
- Timer precision: server-authoritative timestamps to prevent cheating
- Answer state: other players see who has answered (dot indicator) but not what
- Speed bonus: linear interpolation (answer at 0s remaining = 0% bonus, instant = 50%)

---

## Phase 3: The Host (Critical Path)

**Goal:** AI generates all questions and the host speaks with personality.

### Deliverables
- [x] Claude API integration with structured output (tool use)
- [x] Question generation prompt engineering
- [x] Host personality system prompt
- [x] Personalized commentary generation (uses player names, scores, streaks)
- [x] ElevenLabs TTS integration (pre-generation + live-buffered)
- [x] Browser Speech Synthesis fallback (free, no API key needed)
- [x] Web Audio API synthesized SFX (correct, wrong, timer, transitions, fanfares)
- [x] Audio playback on client (Web Audio API)
- [x] Voice pre-buffering strategy (batch-generate ~33 clips during loading)
- [x] Text fallback when voice is unavailable or slow
- [x] Open Trivia DB integration for seed facts
- [x] Question caching in SQLite
- [x] Host intro → question → reveal flow with voice at each step
- [x] Cost monitoring / logging for API usage

### Key Decisions
- ElevenLabs voice: ID `1t1EeRixsJrKbiF1zwM6`, eleven_turbo_v2 model
- Two-tier audio: Tier 1 pre-generates ~33 clips during 18s loading; Tier 2 live AI commentary as bonus
- Personalization frequency: every question gets a personalized host line
- **ElevenLabs on Railway:** Free tier is blocked by Railway's shared IPs (triggers abuse detection). Requires **paid plan** ($5+/mo) to work in production. Browser Speech Synthesis is the current fallback.

### Technical Risks
- ~~ElevenLabs latency may cause awkward pauses~~ — mitigated with pre-buffering
- ~~Claude structured output may occasionally break schema~~ — validation + retry in place
- ElevenLabs on Railway free tier: shared IP triggers 401. Use paid plan or self-host.

---

## Phase 4: Question Variety

**Goal:** All 5 question types working with AI generation.

### Deliverables
- [x] DisOrDat question type
  - [x] UI: two category labels, items appear one at a time (6s each, 7 items)
  - [x] All players compete simultaneously
  - [x] Seed data: 8 DisOrDat question sets
  - [x] Scoring: question value / 7 per correct item, no penalty
- [x] Gibberish Question type
  - [x] UI: garbled phrase displayed prominently + 4 MC choices
  - [x] Seed data: 12 Gibberish questions
  - [x] Standard MC answer submission
  - [ ] Host voice reads the gibberish phrase (needs TTS integration)
  - [ ] Hint appears after 10 seconds (not yet implemented)
- [x] ThreeWay question type
  - [x] UI: three options cycle/highlight (1.8s each)
  - [x] Players BUZZ when correct one is highlighted
  - [x] Seed data: 12 ThreeWay questions
- [x] Jack Attack finale
  - [x] UI: theme + clue display, word stream, BUZZ button
  - [x] Server-controlled timing for answer words (3.5s each)
  - [x] Buzz-in mechanic with real-time scoring
  - [x] +$2000 correct / -$2000 wrong
  - [x] Scores revealed at end
  - [x] Seed data: 5 Jack Attack rounds (15 words each, 5 correct)
- [x] Question type rotation per game (QUESTION_TYPE_SCHEDULE constant)
- [ ] AI generation for all question types (currently seed data only)

### Key Decisions
- Jack Attack latency: server sends "word_active" events, players buzz with timestamps, server validates within tolerance window (±200ms)
- Gibberish: AI must generate phrases that actually sound right when spoken by TTS
- DisOrDat: show results after all 7 items (not per-item) for better pacing

---

## Phase 5: Power-Ups & Easter Eggs

**Goal:** Catch-up mechanics and hidden bonuses add strategic depth.

### Deliverables
- [ ] Power-up system
  - [ ] Auto-grant to bottom 2 players every 3 questions
  - [ ] Additional power-up for players >$5,000 behind leader
  - [ ] Time Steal implementation (server modifies timers)
  - [ ] Double Down implementation (score multiplier)
  - [ ] Fake Answer implementation (inject 5th option to opponents)
  - [ ] Point Leech implementation (steal % from leader)
  - [ ] Immunity implementation (cancel penalty)
  - [ ] Reveal implementation (eliminate one wrong answer)
  - [ ] Power-up UI (icons, tap to activate, animations)
  - [ ] Host commentary on power-up usage
  - [ ] Max 3 power-ups held at once
- [ ] Easter Egg system
  - [ ] Wrong Answer of the Game (1 per game, hinted in host intro)
  - [ ] Speed Demon bonus (3 answers under 3 seconds)
  - [ ] Category Sweep bonus (all correct in one category)
  - [ ] Last to First bonus (overtake from last to first in one round)
  - [ ] The Contrarian bonus (pity bonus for all wrong)
  - [ ] Easter egg discovery animation and host reaction
  - [ ] Post-game Easter egg reveal
- [ ] Balance testing: ensure power-ups and Easter eggs don't break scoring

### Key Decisions
- Fake Answer: the AI-generated fake must be funny and plausible
- Power-up notification: all players see when someone uses a power-up
- Easter egg hints: AI embeds subtle hints in host commentary

---

## Phase 6: Audio & Visual Polish

**Goal:** Full retro pixel art aesthetic with complete audio design.

### Deliverables
- [ ] Pixel art UI theme
  - [ ] Custom pixel font for headings/scores
  - [ ] Readable sans-serif for question text
  - [ ] Dark background with neon accent colors
  - [ ] CRT scanline effect (optional toggle)
  - [ ] Pixel art host avatar with reaction animations
  - [ ] Pixel art power-up icons
  - [ ] Chunky mobile-friendly buttons
- [ ] Animations
  - [ ] Question card slide-in transitions
  - [ ] Correct answer: green flash + pixel confetti
  - [ ] Wrong answer: red shake + pixel skull
  - [ ] Score counter: arcade-style rolling numbers
  - [ ] Timer: pixel segments draining
  - [ ] Jack Attack: words zooming in/out
  - [ ] Power-up activation effects
  - [ ] Easter egg discovery celebration
- [x] Sound effects (Web Audio API — no external service needed)
  - [x] Correct answer chime (ascending two-note)
  - [x] Wrong answer buzzer (sawtooth)
  - [x] Timer tick + warning tick
  - [x] Question transition whoosh
  - [x] Game start fanfare
  - [x] Round transition sweep
  - [x] Score reveal shimmer
  - [x] Game over finale
  - [x] Button tap
- [x] Host voice (browser Speech Synthesis — free fallback)
  - [x] Browser TTS wired to all host scripts (game_starting, question_intro, question_reveal, round_transition, game_over)
  - [x] `speakText()` / `stopSpeaking()` in sound-system.ts
  - [x] Prefers high-quality English voice (Google, Samantha, Daniel) if available
- [ ] Background music (chiptune loops — not yet implemented)
  - [ ] Lobby waiting loop
  - [ ] Question thinking loop
  - [ ] Last-5-seconds tension loop
  - [ ] Victory fanfare
- [ ] Volume control (separate for music, SFX, voice)
- [ ] Mobile optimization
  - [x] Audio autoplay handling (user gesture requirement — initAudio() on Start button)
  - [ ] Touch target sizes (min 48px)
  - [ ] Viewport handling (avoid iOS Safari issues)
  - [ ] Performance optimization (60fps animations)

### Key Decisions
- Pixel font: "Press Start 2P" (Google Fonts, free) for headings
- Chiptune music: source from royalty-free libraries or generate with tools like BeepBox
- Animation library: Framer Motion (works great with React, handles mobile well)

---

## Phase 7: Deployment & Testing

**Goal:** Live on Railway, tested with real friend groups.

### Deliverables
- [ ] Railway deployment configuration
  - [ ] Dockerfile or railway.toml
  - [ ] Persistent volume for SQLite
  - [ ] Environment variables configured
  - [ ] Custom domain (optional)
- [ ] Production hardening
  - [ ] Rate limiting on API routes
  - [ ] Error logging (console or simple service)
  - [ ] Room cleanup (auto-delete after 2 hours inactive)
  - [ ] Memory management (don't leak game rooms)
  - [ ] WebSocket connection limits
- [ ] Testing
  - [ ] Unit tests for game engine (scoring, state machine, power-ups)
  - [ ] Integration tests for Socket.io events
  - [ ] Manual playtesting with 2-3 friend groups
  - [ ] Mobile device testing (iOS Safari, Android Chrome)
  - [ ] Load testing (10 simultaneous players)
- [ ] Bug fixes from playtesting
- [ ] Game balance adjustments
- [ ] Final AI prompt tuning based on real gameplay

---

## Post-Launch Improvements (Future)

Not scoped for initial release, but ideas for later:

- [ ] More question types (picture questions, audio questions, ordering)
- [ ] Player avatars (choose from pixel art characters)
- [ ] Seasonal themes (Halloween, Holiday specials)
- [ ] All-time leaderboard (requires optional accounts)
- [ ] Custom question packs (user-submitted)
- [ ] Multiple host personalities to choose from
- [ ] Achievements system
- [ ] "Rematch" with same players (tracks series)
- [ ] Shareable game recaps (screenshot/link of final scores)
- [ ] Difficulty settings (easy/medium/hard)

---

## Milestones & Acceptance Criteria

### M1: First Connection (End of Phase 1) ✅ COMPLETE
**Demo:** Create a room on your laptop, join from your phone with a room code, see both players in the lobby.
- [x] Room code generation works and is displayed
- [x] 2+ players can join the same room from different devices
- [x] Player list updates in real-time when someone joins/leaves
- [x] "Start Game" button appears for the room creator
- [x] Mobile layout is usable (no horizontal scroll, readable text)

### M2: First Game (End of Phase 2) ✅ COMPLETE
**Demo:** Play a full 10-question game with hardcoded questions and see final scores.
- [x] Game flows from lobby → round 1 (5 Qs) → round 2 (5 Qs) → game over
- [x] Answers are submitted and scored correctly (with speed bonus)
- [x] Timer counts down and auto-advances if nobody answers
- [x] Scores update after each question and are visible to all players
- [x] Round 2 values are doubled
- [x] Game over screen shows winner and final rankings
- [x] "Play Again" returns to lobby with same players
- [x] 200 seed questions with dedup tracking per player group
- [x] Don't Be a Wimp mode (shorter timer if nobody answers)

### M3: The Host Lives (End of Phase 3) ✅ COMPLETE
**Demo:** Play a game where the AI host generates unique questions and speaks them aloud.
- [x] Question pipeline: Open Trivia DB seeds → Claude rewrites in YDKJ style → validate → fallback to seed bank
- [x] Host voice plays via browser Speech Synthesis (free fallback; ElevenLabs needs paid plan on Railway)
- [x] Web Audio API SFX on all game events (correct, wrong, transitions, fanfares, etc.)
- [x] Two-tier audio: Tier 1 pre-generates ~33 clips during loading, Tier 2 live AI commentary as bonus
- [x] Host uses player names in commentary (Claude AI personalization)
- [x] Voice doesn't cause noticeable delays (pre-buffered during loading phase)
- [x] Text fallback displays if voice is slow or fails
- [x] Different questions each game (200 seed bank + AI generation + dedup tracking)
- [x] Loading screen with progress bar and quirky messages
- [x] Deployed on Railway
- [x] Reconnection: disconnect on screen lock marks player disconnected (not removed); rejoin_room event restores state
- [x] Fixed: Q2+ never showing (questionIndex wasn't synced from server to client)
- [x] Fixed: mobile freeze after answering (Wimp Mode race condition — client ignores stale question_active events)

### M4: Full Variety (End of Phase 4) ✅ COMPLETE
**Demo:** Play a game with all 5 question types including Jack Attack finale.
- [x] Multiple Choice, DisOrDat, Gibberish, ThreeWay all work
- [x] DisOrDat: all players compete simultaneously, items appear one at a time (6s each)
- [x] Gibberish: phrase displayed prominently, 4 MC choices
- [x] ThreeWay: cycling highlight (1.8s), BUZZ submits highlighted choice
- [x] Jack Attack: server-driven word stream, buzz-in, scores revealed at end
- [x] Question type order follows QUESTION_TYPE_SCHEDULE
- [x] Seed data: 12 gibberish, 8 dis-or-dat, 12 three-way, 5 jack-attack rounds

### M5: Strategic Depth (End of Phase 5)
**Demo:** Play a game where trailing players receive and use power-ups, and an Easter egg is discovered.
- [ ] Bottom players receive power-ups every 3 questions
- [ ] All 6 power-up types function correctly
- [ ] Power-up animations and host reactions play
- [ ] Wrong Answer of the Game can be discovered
- [ ] At least one other Easter egg triggers naturally
- [ ] Power-ups don't break the scoring system

### M6: Looks & Sounds Amazing (End of Phase 6)
**Demo:** Play a game that looks and sounds like a polished retro arcade game.
- [ ] Pixel art UI theme throughout (fonts, buttons, cards, backgrounds)
- [ ] Animations for all game events (correct, wrong, transitions, etc.)
- [ ] Background music plays and transitions between game states
- [x] SFX play for key moments (answers, timer, power-ups) — Web Audio API
- [x] Host voice works (browser TTS) and SFX play on all game events
- [ ] Volume controls work
- [ ] Mobile performance is smooth (no janky animations)

### M7: Game Night Ready (End of Phase 7)
**Demo:** Host a real game night with friends using the deployed version.
- [ ] Deployed on Railway with a working URL
- [ ] 10 players can connect and play without crashes
- [ ] No game-breaking bugs found in 3+ playtesting sessions
- [ ] API costs are within $20-50/mo budget
- [ ] Game results are saved and viewable
- [ ] Reconnection works if a player's phone sleeps briefly
