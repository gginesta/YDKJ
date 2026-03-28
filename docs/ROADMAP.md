# Development Roadmap

## Phase Overview

| Phase | Name | Duration | Goal |
|-------|------|----------|------|
| 1 | Foundation | 1-2 weeks | Project setup, core infrastructure, basic game flow |
| 2 | Core Game | 2-3 weeks | Multiple choice working end-to-end with scoring |
| 3 | The Host | 1-2 weeks | AI question generation + ElevenLabs voice |
| 4 | Question Variety | 1-2 weeks | DisOrDat, Gibberish, ThreeWay, Jack Attack |
| 5 | Power-Ups & Polish | 1-2 weeks | Catch-up mechanics, Easter eggs, animations |
| 6 | Audio & Visual Polish | 1-2 weeks | Full audio design, pixel art, animations |
| 7 | Deployment & Testing | 1 week | Railway deployment, playtesting, bug fixes |

**Total estimated: 8-14 weeks** (depending on pace)

---

## Phase 1: Foundation ✅ COMPLETE

**Goal:** Skeleton app running with real-time multiplayer connectivity.

### Deliverables
- [x] Next.js 14 project initialized with TypeScript
- [x] Tailwind CSS configured with clean streaming-show theme
- [x] Socket.io server integrated with Next.js (custom server)
- [x] Room creation with 4-letter codes
- [x] Player join/leave flow
- [x] Lobby UI (mobile-first) showing connected players
- [x] Basic game state machine (lobby → playing → game over)
- [x] SQLite database setup with schema
- [x] Environment variable configuration (.env.example)
- [x] Development tooling (ESLint)

### Key Decisions
- Custom Next.js server needed for Socket.io (can't use default serverless)
- Room codes: 4 uppercase letters, excluding ambiguous chars (O/0, I/1, L)
- State machine library: `xstate` v5 or custom (evaluate complexity)

### Technical Risks
- Socket.io + Next.js App Router integration can be tricky
- Need custom server.ts to attach Socket.io to the HTTP server

---

## Phase 2: Core Game ✅ ~90% COMPLETE

**Goal:** Play a complete game of multiple choice trivia with scoring.

### Deliverables
- [x] Game state machine: full flow from lobby to game over
- [x] Multiple choice question display (mobile-optimized)
- [x] Answer submission with server-side timing
- [x] Server-side answer validation
- [x] Money-based scoring with speed bonuses
- [x] Score display with animated counters
- [x] Timer countdown UI (per question)
- [x] Round 1 → Round 2 transition (doubled values)
- [x] Game over screen with final standings
- [x] 32 hardcoded sample questions with host scripts
- [ ] Reconnection handling (player phone sleeps) — _partially scaffolded_
- [x] Play again flow

### Key Decisions
- Timer precision: server-authoritative timestamps to prevent cheating
- Answer state: other players see who has answered (dot indicator) but not what
- Speed bonus: linear interpolation (answer at 0s remaining = 0% bonus, instant = 50%)

---

## Phase 3: The Host (Critical Path)

**Goal:** AI generates all questions and the host speaks with personality.

### Deliverables
- [ ] Claude API integration with structured output (tool use)
- [ ] Question generation prompt engineering
- [ ] Host personality system prompt
- [ ] Personalized commentary generation (uses player names, scores, streaks)
- [ ] ElevenLabs TTS integration (streaming)
- [ ] Audio playback on client (Web Audio API)
- [ ] Voice pre-buffering strategy (generate 1-2 states ahead)
- [ ] Text fallback when voice is unavailable or slow
- [ ] Open Trivia DB integration for seed facts
- [ ] Question caching in SQLite
- [ ] Host intro → question → reveal flow with voice at each step
- [ ] Cost monitoring / logging for API usage

### Key Decisions
- ElevenLabs voice selection: test 3-4 voices, pick one that fits the character
- Streaming vs. batch TTS: streaming for long intros, batch for short reactions
- Pre-generation: batch generate all 12 questions at game start (during intro)
- Personalization frequency: every question gets a personalized host line

### Technical Risks
- ElevenLabs latency may cause awkward pauses (mitigate with pre-buffering)
- Claude structured output may occasionally break schema (need validation + retry)
- Cost per game needs monitoring to stay within budget

---

## Phase 4: Question Variety

**Goal:** All 5 question types working with AI generation.

### Deliverables
- [ ] DisOrDat question type
  - [ ] UI: two category labels, items appear one at a time
  - [ ] All players compete simultaneously
  - [ ] AI generation prompt for DisOrDat pairs
  - [ ] Scoring: per-item within the question
- [ ] Gibberish Question type
  - [ ] UI: garbled phrase display + audio playback
  - [ ] 4 multiple choice options for the real phrase
  - [ ] AI generation: create phonetically similar garbled versions
  - [ ] Host voice reads the gibberish phrase
  - [ ] Hint appears after 10 seconds
- [ ] ThreeWay question type
  - [ ] UI: three options cycle/highlight
  - [ ] Players buzz when correct one is shown
  - [ ] AI generation for word-association triples
- [ ] Jack Attack finale
  - [ ] UI: central clue word + flying answer words
  - [ ] Server-controlled timing for answer words (3s each)
  - [ ] Buzz-in mechanic with latency compensation
  - [ ] Score hidden during round, revealed at end
  - [ ] AI generation for theme, clue, and word pairs
- [ ] Question type rotation per game (structured order per round)
- [ ] Update AI prompts to generate all types in one batch

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
- [ ] Audio implementation
  - [ ] Audio manager (handles music, SFX, voice simultaneously)
  - [ ] Background music: lobby, thinking, tension, victory (chiptune)
  - [ ] SFX: correct, wrong, timer tick, buzz, power-up, join/leave
  - [ ] Music transitions between game states
  - [ ] Volume control (separate for music, SFX, voice)
  - [ ] Source/commission chiptune tracks (or use royalty-free)
- [ ] Mobile optimization
  - [ ] Touch target sizes (min 48px)
  - [ ] Viewport handling (avoid iOS Safari issues)
  - [ ] Audio autoplay handling (user gesture requirement)
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

### M1: First Connection (End of Phase 1) ✅ ACHIEVED
**Demo:** Create a room on your laptop, join from your phone with a room code, see both players in the lobby.
- [x] Room code generation works and is displayed
- [x] 2+ players can join the same room from different devices
- [x] Player list updates in real-time when someone joins/leaves
- [x] "Start Game" button appears for the room creator
- [x] Mobile layout is usable (no horizontal scroll, readable text)

### M2: First Game (End of Phase 2) ✅ ACHIEVED
**Demo:** Play a full 10-question game with hardcoded questions and see final scores.
- [x] Game flows from lobby → round 1 (5 Qs) → round 2 (5 Qs) → game over
- [x] Answers are submitted and scored correctly (with speed bonus)
- [x] Timer counts down and auto-advances if nobody answers
- [x] Scores update after each question and are visible to all players
- [x] Round 2 values are doubled
- [x] Game over screen shows winner and final rankings
- [x] "Play Again" returns to lobby with same players

### M3: The Host Lives (End of Phase 3)
**Demo:** Play a game where the AI host generates unique questions and speaks them aloud.
- [ ] Questions are generated by Claude (not hardcoded) and feel like YDKJ
- [ ] Host voice plays via ElevenLabs for question intros and reactions
- [ ] Host uses player names in commentary
- [ ] Voice doesn't cause noticeable delays (pre-buffering works)
- [ ] Text fallback displays if voice is slow or fails
- [ ] Different questions generated each game

### M4: Full Variety (End of Phase 4)
**Demo:** Play a game with all 5 question types including Jack Attack finale.
- [ ] Multiple Choice, DisOrDat, Gibberish, ThreeWay all work
- [ ] DisOrDat: all players compete simultaneously, items appear one at a time
- [ ] Gibberish: host voice reads the garbled phrase, hint appears after 10s
- [ ] Jack Attack: words fly by, buzz-in works, scores hidden then revealed
- [ ] Question type order follows the structured round template

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
- [ ] SFX play for key moments (answers, timer, power-ups)
- [ ] Voice, music, and SFX play simultaneously without issues
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
