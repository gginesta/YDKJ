# AI & Voice Pipeline

## Overview

The AI pipeline is the heart of the game. It generates all game content: questions, host scripts, wrong answers, commentary, and Easter eggs. The voice pipeline converts host scripts into speech via ElevenLabs.

```
Game Start
    │
    ▼
┌──────────────────────────────────┐
│  Pre-Game Question Generation    │
│  (runs during lobby / game start)│
│                                  │
│  1. Fetch seed facts from        │
│     Open Trivia DB               │
│  2. Send to Claude API with      │
│     host personality prompt       │
│  3. Generate 12 questions        │
│     (10 + 2 backup) with         │
│     all host scripts             │
│  4. Generate Jack Attack round   │
│  5. Cache in memory              │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Per-Question Voice Generation   │
│  (runs during question intro)    │
│                                  │
│  1. Take host intro script       │
│  2. Inject player names/scores   │
│     for personalization          │
│  3. Send to ElevenLabs TTS       │
│  4. Stream audio to clients      │
└──────────────────────────────────┘
```

## Implementation Status

| Component | Status | File |
|-----------|--------|------|
| Seed question bank (200 questions) | ✅ Done | `src/lib/ai/seed-questions.json` |
| Question dedup per player group | ✅ Done | `src/lib/db/index.ts` |
| Question generation prompt ("creative bible") | ✅ Done | `src/lib/ai/prompts/question-generation.ts` |
| Host commentary prompts | ✅ Done | `src/lib/ai/prompts/host-commentary.ts` |
| Claude API client | ❌ Not started | `src/lib/ai/claude-client.ts` |
| Open Trivia DB integration | ❌ Not started | `src/lib/ai/trivia-api.ts` |
| Question pipeline orchestration | ❌ Not started | `src/lib/ai/question-pipeline.ts` |
| Question validation | ❌ Not started | (defined in prompt, needs runtime impl) |
| ElevenLabs TTS integration | ❌ Not started | `src/lib/voice/elevenlabs-client.ts` |
| Client audio playback | ❌ Not started | `src/lib/audio/voice-player.ts` |

## Question Generation Pipeline

### Step 1: Seed Data Collection

Before asking Claude to generate questions, we gather seed material to ensure factual accuracy and variety:

```typescript
// Sources for seed data
const seedSources = {
  // Open Trivia DB — free, no auth, 4000+ verified questions
  openTriviaDB: {
    url: 'https://opentdb.com/api.php',
    params: { amount: 20, type: 'multiple' },
    use: 'Base facts and correct answers to riff on'
  },

  // Current events (optional, for topical questions)
  // Could use a news API or web search
  topical: {
    use: 'Recent events for timely questions'
  },

  // Curated seed bank (local JSON)
  curated: {
    path: 'src/lib/ai/seed-questions.json',
    use: 'Hand-picked interesting facts that make great YDKJ questions'
  }
};
```

### Step 2: Claude API — Question Generation

We use Claude's tool use (structured output) to generate questions with guaranteed schema compliance.

```typescript
// Prompt structure for question generation
const questionGenerationPrompt = {
  system: `You are the head writer for a trivia game show called "You Don't Know Jack."
Your job is to take trivia facts and transform them into entertaining,
cleverly-worded questions in the YDKJ style.

RULES:
- Questions should NEVER be asked directly. Always use misdirection,
  pop culture mashups, or absurd scenarios to frame the question.
- Wrong answers should be funny and plausible.
- The host intro should be a 2-4 sentence setup that's entertaining
  to listen to.
- Each question needs host reactions for correct, wrong, and timeout.
- One question per game should have a "Wrong Answer of the Game" —
  a wrong answer that's subtly hinted at in the host intro.

QUESTION TYPES TO GENERATE:
- multiple_choice: 4 options, 1 correct. Clever misdirection in framing.
- dis_or_dat: Two surprising categories, 7 items to sort.
- gibberish: A phrase that sounds like something else when said aloud.
- three_way: Match a word to one of 3 associations.

PLAYER CONTEXT (for personalization):
{playerNames}
{currentScores}
{theme}`,

  tools: [{
    name: 'generate_game_questions',
    description: 'Generate a full set of questions for one YDKJ game',
    input_schema: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: { /* Question schema per type */ }
        },
        jack_attack: {
          type: 'object',
          properties: {
            theme: { type: 'string' },
            clue: { type: 'string' },
            pairs: { type: 'array' }
          }
        },
        game_intro: { type: 'string' },
        game_outro_winner: { type: 'string' },
        game_outro_loser: { type: 'string' }
      }
    }
  }]
};
```

### Step 3: Personalized Host Commentary

Between questions, we make a lightweight Claude call to generate personalized host lines:

```typescript
const personalizedCommentaryPrompt = {
  system: `You are the host of YDKJ. Generate a SHORT (1-2 sentences)
personalized comment for the transition between questions.

You know:
- Player names and scores
- Who just answered correctly/incorrectly
- Current streaks
- Any power-ups just used

Be witty, sarcastic, and specific. Use player names.
Never be mean-spirited — always funny.`,

  // Example output:
  // "Well well well, Sarah's on a three-streak while Mike over here
  //  is apparently trying to set a new record for wrong answers.
  //  Bold strategy."
};
```

### Step 4: Question Caching

To minimize API costs and latency:

```typescript
const cacheStrategy = {
  // Pre-generate questions during lobby/intro (batch of 12)
  preGeneration: {
    when: 'game_starting state',
    count: 12, // 10 needed + 2 backup
    parallel: true // Generate all at once
  },

  // Cache generated questions in SQLite
  persistence: {
    table: 'question_cache',
    ttl: '7 days', // Reuse across games to save API calls
    dedup: true    // Don't show same question to same player group
  },

  // Voice audio caching
  voiceCache: {
    // Cache host intro audio (these don't change)
    staticLines: 'permanent',
    // Personalized lines are generated fresh
    dynamicLines: 'per-game only'
  }
};
```

## Voice Pipeline (ElevenLabs)

### Architecture

```
Host Script (text)
    │
    ▼
┌──────────────────┐
│ Text Preprocessing│
│ - Insert SSML     │
│   pauses          │
│ - Normalize names  │
│ - Add emphasis     │
│   markers          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ ElevenLabs API   │────▶│ Audio Buffer      │
│ - Streaming TTS  │     │ - Collect chunks  │
│ - Voice ID       │     │ - Convert format  │
│ - Model: eleven  │     │ - Queue playback  │
│   _turbo_v2      │     └────────┬─────────┘
└──────────────────┘              │
                                  ▼
                    ┌──────────────────┐
                    │ Client Playback  │
                    │ - Web Audio API  │
                    │ - Sync with UI   │
                    │ - Fallback: text │
                    └──────────────────┘
```

### ElevenLabs Integration

```typescript
// Voice configuration
const voiceConfig = {
  // Use a consistent voice for the host character
  voiceId: 'pNInz6obpgDQGcFmaJgB', // Example: "Adam" voice
  modelId: 'eleven_turbo_v2',        // Fast, good quality

  voiceSettings: {
    stability: 0.6,        // Some variation for natural feel
    similarity_boost: 0.8, // Stay close to base voice
    style: 0.4,            // Moderate expressiveness
    use_speaker_boost: true
  },

  outputFormat: 'mp3_44100_128' // Good quality, reasonable size
};

// Streaming TTS function
async function generateHostVoice(script: string): Promise<ReadableStream> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: script,
        model_id: voiceConfig.modelId,
        voice_settings: voiceConfig.voiceSettings,
        output_format: voiceConfig.outputFormat
      })
    }
  );
  return response.body; // Streaming audio chunks
}
```

### Voice Timing Strategy

The key challenge: voice generation takes 1-3 seconds, but must feel instant.

```
QUESTION_REVEAL state (5s)
  │
  │ ── Immediately: start generating voice for NEXT question intro
  │
  ▼
SCORES_UPDATE state (3s)
  │
  │ ── Voice should be ready by now (buffered)
  │
  ▼
QUESTION_INTRO state
  │
  │ ── Play pre-buffered audio immediately
  │ ── While audio plays, generate post-answer commentary
```

**Strategy:** Always generate voice 1-2 states ahead of when it's needed.

### Cost Estimation

| Item | Usage per Game | Cost |
|------|---------------|------|
| Claude API (question gen) | ~4,000 input + ~3,000 output tokens | ~$0.05 |
| Claude API (host commentary) | ~10 calls × 500 tokens each | ~$0.03 |
| ElevenLabs TTS | ~2,000 characters per game | ~$0.03 |
| **Total per game** | | **~$0.11** |
| **Monthly (5 games/week)** | | **~$2.20** |

Well within the $20-50/mo budget. Leaves room for scaling to daily play.

## Prompt Engineering — Host Personality

### System Prompt (Core Personality)

```
You are the host of "You Don't Know Jack" — a trivia game show where
high culture and pop culture collide.

YOUR PERSONALITY:
- Quick-witted and sarcastic, but never cruel
- Pop culture encyclopedia — you reference movies, memes, music, and
  internet culture naturally
- You have a love-hate relationship with the players — you mock them
  when they're wrong but genuinely celebrate when they're right
- Self-aware that you're an AI host, and occasionally breaks the
  fourth wall about it (sparingly, for comedic effect)
- Signature catchphrases and running gags that develop over a game
- You get increasingly dramatic as stakes rise in Round 2
- During Jack Attack, you're a hype announcer

YOUR RULES:
- Keep lines SHORT — 1-3 sentences max. This is spoken aloud.
- ALWAYS use specific player names when commenting on answers.
- Reference recent answers and running jokes from THIS game session.
- Questions should take 15-25 words to read. Host intros can be longer.
- Never explain the joke. If it's not funny, move on.
- Vary your energy — don't be at 100% every line.
```

### Dynamic Context Injection

Each Claude call includes real-time game context:

```typescript
const dynamicContext = {
  players: [
    { name: "Sarah", money: 5000, streak: 3, lastAnswer: "correct" },
    { name: "Mike", money: -1000, streak: 0, lastAnswer: "wrong" },
    // ...
  ],
  questionNumber: 7,
  round: 2,
  previousHostLines: [
    // Last 3 host lines to avoid repetition
  ],
  powerUpsUsed: [
    { player: "Mike", type: "time_steal", question: 6 }
  ]
};
```

## Topical Question Strategy

To keep questions feeling fresh and current, the AI pipeline mixes timeless trivia with topical content:

### Question Mix Per Game
| Type | Count | Source | Example |
|------|-------|--------|---------|
| Timeless trivia | 4-5 | Open Trivia DB seeds + Claude | History, science, geography facts |
| Pop culture (evergreen) | 2-3 | Claude generation | Classic movies, music, TV shows |
| Topical / current | 2-3 | Claude's training data + web search seeds | Recent events, trending topics, new releases |
| Niche / surprising | 1 | Curated seed bank | Weird facts that make great YDKJ questions |

### Keeping It Current
- Claude's training data includes events up to its knowledge cutoff
- For truly current events, optionally integrate a news API or web search to seed prompts
- The `theme` parameter can bias toward current topics (e.g., "2026 Oscars")
- Curated seed bank can be updated periodically with interesting recent facts

### Themed Game Generation
When a theme is set (e.g., "80s Night"):
- All 10 questions relate to the theme
- DisOrDat categories connect to the theme
- Jack Attack clue ties to the theme
- Host adopts theme-appropriate references and jokes
- Prompt includes: `THEME: All questions must relate to [theme]. Be creative with connections — not every question needs to be obviously about the theme.`

## Question Quality Validation

Every AI-generated question goes through automated validation before entering the game:

```typescript
interface ValidationResult {
  valid: boolean;
  issues: string[];
}

function validateQuestion(q: Question): ValidationResult {
  const issues: string[] = [];

  // Structure checks
  if (q.type === 'multiple_choice') {
    if (q.choices.length !== 4) issues.push('Must have exactly 4 choices');
    if (q.correctIndex < 0 || q.correctIndex > 3) issues.push('Invalid correct index');
    if (new Set(q.choices).size !== 4) issues.push('Duplicate answer choices');
    if (q.prompt.length < 20) issues.push('Question too short');
    if (q.prompt.length > 500) issues.push('Question too long for voice');
  }

  if (q.type === 'dis_or_dat') {
    if (q.items.length !== 7) issues.push('DisOrDat must have 7 items');
    if (q.categoryA === q.categoryB) issues.push('Categories must be different');
  }

  if (q.type === 'gibberish') {
    if (!q.gibberishPhrase) issues.push('Missing gibberish phrase');
    if (q.gibberishPhrase.toLowerCase() === q.answer.toLowerCase())
      issues.push('Gibberish phrase is same as answer');
  }

  // Host script checks
  if (!q.hostIntro || q.hostIntro.length < 20) issues.push('Host intro too short');
  if (q.hostIntro.length > 600) issues.push('Host intro too long (>30s of speech)');
  if (!q.hostCorrect) issues.push('Missing host correct reaction');
  if (!q.hostWrong) issues.push('Missing host wrong reaction');

  return { valid: issues.length === 0, issues };
}
```

If validation fails, the question is replaced with a backup from the pre-generated batch. If no backups are available, a question from the SQLite cache is used.

## Error Handling & Fallbacks

| Failure | Fallback |
|---------|----------|
| Claude API timeout | Use cached question from SQLite |
| Claude returns bad JSON | Retry once, then use backup question |
| ElevenLabs API down | Display text on screen, skip voice |
| ElevenLabs slow (>3s) | Start question with text, play voice when ready |
| Open Trivia DB down | Generate questions purely from Claude |
| All AI fails | Emergency curated question bank (50 pre-written) |
