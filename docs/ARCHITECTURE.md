# Architecture & Technical Design

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENTS (Mobile-First)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Player 1 │ │ Player 2 │ │ Player 3 │ │  ...10   │   │
│  │ (Phone)  │ │ (Phone)  │ │ (Phone)  │ │          │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       │             │             │             │         │
│       └─────────────┴──────┬──────┴─────────────┘         │
│                            │ WebSocket (Socket.io)        │
└────────────────────────────┼────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────┐
│                     SERVER (Railway)                      │
│                            │                              │
│  ┌─────────────────────────▼──────────────────────────┐  │
│  │              Socket.io Server                       │  │
│  │  - Room management                                  │  │
│  │  - Player connections                               │  │
│  │  - Game state broadcast                             │  │
│  └──────────────┬──────────────────┬──────────────────┘  │
│                 │                  │                      │
│  ┌──────────────▼───────┐  ┌──────▼───────────────────┐  │
│  │    Game Engine        │  │   Next.js API Routes     │  │
│  │  - State machine      │  │  - POST /api/game/create │  │
│  │  - Scoring            │  │  - POST /api/ai/generate │  │
│  │  - Timer management   │  │  - POST /api/voice/tts   │  │
│  │  - Power-up logic     │  │  - GET  /api/game/:id    │  │
│  └──────────┬───────────┘  └──────────────────────────┘  │
│             │                                             │
│  ┌──────────▼───────────────────────────────────────────┐│
│  │              AI Pipeline                              ││
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ││
│  │  │ Claude API  │  │ Open Trivia  │  │ ElevenLabs │  ││
│  │  │ (Questions  │  │ DB (Seed     │  │ (TTS Voice │  ││
│  │  │  + Host     │  │  facts)      │  │  Synthesis)│  ││
│  │  │  Scripts)   │  │              │  │            │  ││
│  │  └─────────────┘  └──────────────┘  └────────────┘  ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  ┌──────────────────────────────────────────────────────┐│
│  │  SQLite DB (better-sqlite3)                           ││
│  │  - Game results history                               ││
│  │  - Generated question cache                           ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

## Tech Stack Justification

### Next.js 14 + TypeScript
- **App Router** gives us server components, API routes, and SSR in one package
- **Single deployment** — frontend + backend + WebSocket server on Railway
- **TypeScript** — shared types between client and server prevent bugs in game state sync
- No need for a separate backend service at this scale

### Socket.io for Real-Time
- Built-in **room** concept maps perfectly to game rooms
- Automatic **reconnection** handling (critical if a player's phone sleeps)
- **Binary support** for streaming audio data
- Proven at scale, huge ecosystem
- Fallback to long-polling if WebSockets fail

### Claude API (Anthropic) for AI
- Superior at **creative writing and humor** — essential for the host personality
- Structured output (tool use) for reliable JSON question generation
- Can generate topical questions from its training data
- Good at maintaining a consistent character voice across prompts

### ElevenLabs for TTS
- Most natural-sounding AI voices available
- **Low latency streaming** — can start playing audio before full generation completes
- Voice cloning could let us create a unique host voice
- Websocket streaming API for real-time synthesis

### SQLite (better-sqlite3)
- Zero configuration, file-based
- Perfect for light persistence (game history, question cache)
- Synchronous API works well with Next.js API routes
- No external database service to manage or pay for

### Railway for Deployment
- Native **WebSocket support** (unlike Vercel)
- Simple Docker/Nixpack deploys
- Persistent volume for SQLite file
- Affordable at ~$5-10/mo for this workload

## Data Models

### Game Room
```typescript
interface GameRoom {
  id: string;              // 4-letter room code (e.g., "XKCD")
  hostPlayerId: string;    // Player who created the room
  players: Player[];       // Up to 10 players
  state: GameState;        // Current game state machine state
  round: number;           // Current round (1 or 2)
  questionIndex: number;   // Current question within round
  theme?: string;          // Optional game theme
  questions: Question[];   // Pre-generated questions for this game
  jackAttack: JackAttackRound; // Finale data
  createdAt: number;
  startedAt?: number;
}

interface Player {
  id: string;              // Socket ID or generated UUID
  name: string;            // Display name
  money: number;           // Current score in dollars
  streak: number;          // Consecutive correct answers
  powerUps: PowerUp[];     // Available power-ups
  answers: AnswerRecord[]; // History of answers this game
  connected: boolean;      // Connection status
  joinedAt: number;
}
```

### Questions
```typescript
type QuestionType =
  | 'multiple_choice'
  | 'dis_or_dat'
  | 'gibberish'
  | 'three_way'
  | 'jack_attack';

interface BaseQuestion {
  id: string;
  type: QuestionType;
  category: string;
  value: number;           // Dollar value ($1000-$6000)
  timeLimit: number;       // Seconds to answer
  hostIntro: string;       // Host's intro script (witty framing)
  hostCorrect: string;     // Host commentary on correct answer
  hostWrong: string;       // Host commentary on wrong answer
  hostTimeout: string;     // Host commentary if timer expires
  easterEgg?: EasterEgg;   // Hidden bonus if present
}

interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice';
  prompt: string;          // The actual question text
  choices: string[];       // 4 answer options
  correctIndex: number;    // Index of correct answer
  wrongAnswerOfTheGame?: number; // Index of special wrong answer
}

interface DisOrDatQuestion extends BaseQuestion {
  type: 'dis_or_dat';
  categoryA: string;       // e.g., "Type of Pasta"
  categoryB: string;       // e.g., "Shakespeare Character"
  items: {
    text: string;
    correct: 'A' | 'B';
  }[];                     // 7 items to categorize
}

interface GibberishQuestion extends BaseQuestion {
  type: 'gibberish';
  gibberishPhrase: string; // The garbled phrase
  audioUrl?: string;       // Pre-generated TTS of garbled phrase
  answer: string;          // The real phrase it sounds like
  hint?: string;           // Optional hint after time passes
}

interface ThreeWayQuestion extends BaseQuestion {
  type: 'three_way';
  prompt: string;          // Word or phrase to match
  choices: string[];       // 3 possible matches
  correctIndex: number;
}

interface JackAttackRound {
  theme: string;           // Category hint (e.g., "Movie Stars")
  clue: string;            // Center word (e.g., "Star Wars")
  pairs: {
    answer: string;        // Potential match shown briefly
    isCorrect: boolean;    // Whether it matches the clue
  }[];
  matchValue: number;      // $2000 per correct match
  penaltyValue: number;    // -$2000 per wrong buzz
}
```

### Power-Ups
```typescript
type PowerUpType =
  | 'time_steal'       // Remove 5 seconds from all opponents
  | 'double_down'      // Double your earnings on next question
  | 'fake_answer'      // Add a 5th fake answer to confuse opponents
  | 'point_leech'      // Steal 10% of leader's money if you answer correctly
  | 'immunity'         // No penalty for wrong answer on next question
  | 'reveal'           // Eliminate one wrong answer for yourself

interface PowerUp {
  type: PowerUpType;
  name: string;
  description: string;
  icon: string;           // Pixel art icon reference
}
```

### Answer Records
```typescript
interface AnswerRecord {
  questionId: string;
  questionType: QuestionType;
  answeredAt: number;       // Timestamp of answer submission
  timeToAnswer: number;     // Seconds taken to answer
  isCorrect: boolean;
  selectedIndex?: number;   // For multiple choice / three way
  selectedCategory?: 'A' | 'B'; // For DisOrDat
  moneyEarned: number;     // Net money from this question (can be negative)
  speedBonus: number;      // Speed bonus portion
  powerUpUsed?: PowerUpType; // If player used a power-up this question
}
```

### Game State Enum
```typescript
enum GameState {
  LOBBY = 'lobby',
  GAME_STARTING = 'game_starting',
  ROUND_INTRO = 'round_intro',
  QUESTION_INTRO = 'question_intro',
  QUESTION_ACTIVE = 'question_active',
  QUESTION_REVEAL = 'question_reveal',
  SCORES_UPDATE = 'scores_update',
  ROUND_TRANSITION = 'round_transition',
  JACK_ATTACK_INTRO = 'jack_attack_intro',
  JACK_ATTACK_ACTIVE = 'jack_attack_active',
  JACK_ATTACK_RESULTS = 'jack_attack_results',
  GAME_OVER = 'game_over',
  POST_GAME = 'post_game',
}
```

### Easter Eggs
```typescript
interface EasterEgg {
  type:
    | 'wrong_answer_of_the_game'
    | 'speed_demon'
    | 'category_sweep'
    | 'last_to_first'
    | 'the_contrarian';
  trigger: string;        // What activates it
  reward: number;         // Bonus money
  hostReaction: string;   // Special host line when triggered
}
```

### SQLite Schema
```sql
-- Game results (light tracking)
CREATE TABLE game_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  player_names TEXT NOT NULL,        -- JSON array of player names
  final_scores TEXT NOT NULL,        -- JSON object { name: money }
  winner_name TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  theme TEXT,
  played_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Question cache (avoid regenerating)
CREATE TABLE question_cache (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  question_data TEXT NOT NULL,        -- Full JSON of question object
  times_used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

-- Player group tracking (dedup questions)
CREATE TABLE player_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_names_hash TEXT NOT NULL,   -- Hash of sorted player names
  question_ids_seen TEXT NOT NULL,   -- JSON array of question IDs shown
  last_played DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Audio Delivery Architecture

Voice and audio are delivered to clients via two channels:

```
┌─────────────────────────────────────────────────┐
│  Voice Audio (ElevenLabs TTS)                    │
│                                                   │
│  Server generates TTS → stores as buffer →        │
│  sends audio URL or base64 via Socket.io event    │
│                                                   │
│  Client receives → decodes → plays via Web Audio  │
│  API with AudioContext for precise timing          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Music & SFX (Static Assets)                      │
│                                                   │
│  Pre-loaded on client during lobby phase          │
│  Stored in /public/audio/ as MP3/OGG files        │
│  Managed by AudioManager singleton:               │
│  - Music channel (looping, crossfade)             │
│  - SFX channel (one-shot, overlapping OK)         │
│  - Voice channel (queued, exclusive)              │
│  Each channel has independent volume control      │
└─────────────────────────────────────────────────┘
```

Key constraints:
- iOS Safari requires a user gesture before any audio plays (handle in lobby with "tap to start")
- Voice audio takes priority — SFX duck (reduce volume) when host is speaking
- Music crossfades between states (e.g., thinking loop → tension loop at 5 seconds)

## Game State Machine

```
LOBBY
  │ (host starts game, min 2 players)
  ▼
GAME_STARTING
  │ (host intro monologue, 10s)
  ▼
ROUND_1_INTRO
  │ (host announces round 1)
  ▼
┌─► QUESTION_INTRO
│     │ (host reads question setup, 5-10s)
│     ▼
│   QUESTION_ACTIVE
│     │ (players answer, countdown timer)
│     ▼
│   QUESTION_REVEAL
│     │ (show correct answer, host commentary, 5s)
│     ▼
│   SCORES_UPDATE
│     │ (animate score changes, 3s)
│     ▼
│   (more questions in round?)
│     │ YES → loop back to QUESTION_INTRO
│     │ NO ↓
│     ▼
│   ROUND_TRANSITION
│       │ (round 1 → round 2: "values are doubled!")
│       │ (round 2 → jack attack)
│       ▼
│     (round 2?)
│       YES → back to QUESTION_INTRO (with doubled values)
│       NO ↓
└───────┘
        ▼
JACK_ATTACK_INTRO
  │ (host explains the final round, 8s)
  ▼
JACK_ATTACK_ACTIVE
  │ (fast word association, ~60s)
  ▼
JACK_ATTACK_RESULTS
  │ (show Jack Attack scores)
  ▼
GAME_OVER
  │ (final standings, host outro, MVP callouts)
  ▼
POST_GAME
  │ (play again? return to lobby?)
  ▼
LOBBY (or disconnect)
```

### State Transitions & Timing

| State | Duration | Server Action |
|-------|----------|--------------|
| LOBBY | Indefinite | Wait for host to start |
| GAME_STARTING | 8-12s | Play intro, generate remaining Qs in background |
| QUESTION_INTRO | 5-10s | Stream host TTS, display question framing |
| QUESTION_ACTIVE | 15-20s | Accept answers, track timing for speed bonus |
| QUESTION_REVEAL | 5-8s | Broadcast correct answer, play host reaction |
| SCORES_UPDATE | 3-5s | Animate score changes, grant power-ups to trailing players |
| ROUND_TRANSITION | 5s | Host announces round change |
| JACK_ATTACK_ACTIVE | 60-90s | Rapid-fire word matching |
| GAME_OVER | 15-20s | Final scores, host outro, save to DB |

## Socket.io Events

### Client → Server
```
join_room         { roomCode, playerName }
start_game        { roomCode }
submit_answer     { questionId, answerIndex, timestamp }
use_power_up      { powerUpType, targetPlayerId? }
jack_attack_buzz  { answerId, timestamp }
play_again        { }
leave_room        { }
```

### Server → Client
```
room_joined       { room, player }
player_joined     { player }
player_left       { playerId }
game_starting     { hostScript, audioUrl }
question_intro    { question (redacted answers), hostScript, audioUrl }
question_active   { question (with answers), timeLimit }
answer_received   { playerId }  // shows who has answered (no reveal)
question_reveal   { correctAnswer, playerResults, hostScript, audioUrl }
scores_update     { scores[], powerUpsGranted[] }
round_transition  { round, hostScript, audioUrl }
jack_attack_start { theme, clue }
jack_attack_word  { word, isCorrect }  // server controls timing
jack_attack_end   { results }
game_over         { finalScores, hostScript, audioUrl, gameStats }
power_up_used     { playerId, powerUpType, effect }
error             { message }
```

## Security Considerations

- Room codes are server-generated, not guessable (random 4-char alphanumeric, excluding ambiguous chars)
- All game logic runs server-side — clients only send inputs
- Answer validation happens on the server; client never knows correct answer until reveal
- Rate limiting on answer submissions to prevent spam
- Socket connections authenticated by room membership
- API keys (Claude, ElevenLabs) never exposed to client
- No user data stored beyond display names and game scores
