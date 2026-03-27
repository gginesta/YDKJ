# Game Design Document

## Game Overview

**Title:** YDKJ - You Don't Know Jack (Web Edition)
**Genre:** Multiplayer trivia party game
**Players:** 2-10
**Session Length:** 15-20 minutes
**Platform:** Web browser (mobile-first)

## Core Loop

1. Players join a room via 4-letter code
2. Host (game creator) starts the game
3. AI host introduces the show with personalized banter
4. 10 questions across 2 rounds (5 per round), with values doubling in round 2
5. Jack Attack finale — fast-paced word association
6. Final scores, host roasts, play again

## Game Structure

### Pre-Game Lobby
- Creator gets a room code to share
- Players join and pick display names
- Creator can optionally set a **theme** (e.g., "80s Night", "Science Edition")
- Min 2 players to start, max 10
- Lobby shows connected players with pixel art avatars

### Round 1 (Questions 1-5)
| Question # | Base Value | Type |
|-----------|-----------|------|
| 1 | $1,000 | Multiple Choice |
| 2 | $2,000 | Multiple Choice or ThreeWay |
| 3 | $2,000 | DisOrDat |
| 4 | $3,000 | Multiple Choice |
| 5 | $3,000 | Gibberish Question |

### Round 2 (Questions 6-10) — All values doubled
| Question # | Base Value | Type |
|-----------|-----------|------|
| 6 | $2,000 | Multiple Choice |
| 7 | $4,000 | ThreeWay |
| 8 | $4,000 | Multiple Choice |
| 9 | $6,000 | DisOrDat |
| 10 | $6,000 | Multiple Choice |

### Jack Attack (Finale)
- 60-90 seconds of rapid-fire word association
- A central clue word stays on screen
- Potential answers flash one at a time (~3 seconds each)
- Players buzz in when they see a match
- **+$2,000** for correct buzz, **-$2,000** for wrong buzz
- Scores hidden during this round for drama
- ~15 answer words shown, ~5 are correct matches

## Question Types — Detailed

### Multiple Choice
The bread and butter. 4 options, 1 correct. But the question is never asked straight — it's wrapped in clever misdirection.

**Example:**
> Host: "If a British grandmother and a Japanese sushi chef got into a fight over proper tea etiquette, which of these would they BOTH agree has nothing to do with tea?"
> - A) Oolong
> - B) Matcha
> - C) Earl Grey
> - D) Long Island Iced Tea ✓

**Timing:** 20 seconds after answers appear
**Speed Bonus:** Up to 50% extra based on answer speed

### DisOrDat
7 items appear one at a time. Each belongs to Category A or Category B. All players compete simultaneously.

**Example:**
> "Pasta Shape OR Yoga Pose?"
> - Manicotti → Pasta ✓
> - Vinyasa → Yoga ✓
> - Farfalle → Pasta ✓
> - Warrior II → Yoga ✓
> - Cavatappi → Pasta ✓
> - Shavasana → Yoga ✓
> - Orecchiette → Pasta ✓

**Timing:** 5 seconds per item
**Scoring:** Each correct = question value / 7 (rounded up)

### Gibberish Question
The host reads a garbled phrase aloud. Players must figure out what real phrase it sounds like and select from 4 options.

**Example:**
> Host reads: "Abe Rye Ham Stink On"
> Answer: "Abraham Lincoln" ✓

**Timing:** 20 seconds, hint appears at 10 seconds
**Key:** This REQUIRES the ElevenLabs voice to work properly

### ThreeWay
A word or phrase is shown. Three possible associations appear. Players buzz in when the correct one is highlighted (they cycle through).

**Example:**
> Word: "Mercury"
> - A) Roman God → ✓ (if theme is "Ancient Mythology")
> - B) Planet → ✗
> - C) Car Brand → ✗

**Timing:** Answers cycle every 3 seconds, 3 full cycles

### Jack Attack (Finale)
Word association speed round. A theme is announced, a clue word sits in the center, answer words fly by.

**Example:**
> Theme: "Things that are golden"
> Clue: "Bridge"
> Flying words: "Brooklyn" ... "London" ... "**Golden Gate**" ✓ ... "Chesapeake"

## Scoring System

### Base Scoring
| Mechanic | Amount |
|----------|--------|
| Correct answer | Question's base value |
| Speed bonus | Up to +50% of base value |
| Wrong answer | -50% of base value |
| No answer (timeout) | $0 (no penalty) |
| Jack Attack correct buzz | +$2,000 |
| Jack Attack wrong buzz | -$2,000 |

### Speed Bonus Formula
```
speedBonus = baseValue * 0.5 * (timeRemaining / totalTime)
```
Answer instantly = +50%. Answer at the last second = +0%.

### Streak Bonuses
- 3 correct in a row: host acknowledges ("Someone's on fire!")
- 5 correct in a row: +$1,000 bonus
- All 10 correct: +$5,000 "Perfect Game" bonus (extremely rare)

## Game Pacing & Flow

The feel of each game should follow a dramatic arc:

### Energy Curve
```
Energy
  ▲
  │                                          ████ Jack Attack
  │                                       ███
  │                    ██ Round 2 ramps  ██
  │                  ██  up tension    ██
  │     ██ Round 1 ██                ██
  │   ██  builds  █                ██
  │ ██  slowly                   ██
  │█                           ██
  │ Intro                    ██
  └──────────────────────────────────────────▶ Time
   0min    5min    10min    15min    20min
```

### Pacing Rules
- **Question cadence:** ~90 seconds per question cycle (intro → active → reveal → scores)
- **Breathing room:** Always have a host line between questions to break tension
- **Escalation:** Round 2 questions are harder AND worth more — stakes feel real
- **The dip:** After Round 2, a brief pause before Jack Attack lets players catch their breath
- **The finale:** Jack Attack is the fastest, highest-energy part — no breaks, pure adrenaline
- **The landing:** Game over has a long enough outro (15-20s) for the host to wrap up satisfyingly

### "Don't Be a Wimp" Mechanic
If nobody answers a question (all players let the timer expire):
- The host calls out the **leading player** by name
- "Hey [Leader], you're sitting on $[amount] and you can't even take a guess? Don't be a wimp!"
- The question resets with **10 seconds** on the clock
- Only the leading player is forced to answer (others can jump in too)
- If they still don't answer, the host roasts them and moves on
- This prevents boring games where players play it safe

## Power-Up System (Catch-Up Mechanic)

### How Power-Ups Are Earned
After every 3rd question, the server checks standings:
- **Bottom 2 players** (by money) each receive 1 random power-up
- If a player is more than **$5,000 behind the leader**, they get an additional power-up
- Maximum 3 power-ups held at once

### Power-Up Types

| Power-Up | Effect | Strategic Use |
|----------|--------|--------------|
| **Time Steal** | Remove 5 seconds from all opponents' timers | Use on high-value questions |
| **Double Down** | 2x earnings on your next correct answer | Save for Round 2 doubled values |
| **Fake Answer** | Add a convincing 5th option for opponents | Best on tricky questions |
| **Point Leech** | Steal 10% of leader's money if you answer correctly | High risk/reward when far behind |
| **Immunity** | No penalty for wrong answer | Use when you're unsure |
| **Reveal** | Eliminate one wrong answer (only for you) | Guaranteed advantage |

### Power-Up UX
- Power-ups appear as pixel art icons at the bottom of the player's screen
- Tap to activate before/during a question
- Host announces when power-ups are used: "Oh, looks like [Player] is getting desperate!"
- Animated effects when power-ups activate (screen shake for Time Steal, etc.)

## Easter Egg System

### Wrong Answer of the Game
- 1 question per game has a "special" wrong answer
- If a player selects it, they GAIN the question's value instead of losing it
- Host gives a subtle hint in their intro (only savvy players catch it)
- Host reaction: "Wait... WHAT?! That's the Wrong Answer of the Game! [Player] just earned $X,000!"

### Hidden Bonuses
| Easter Egg | Trigger | Reward |
|-----------|---------|--------|
| **Speed Demon** | Answer 3 questions in under 3 seconds each | +$2,000 |
| **Category Sweep** | Get every question in one category right | +$1,500 |
| **Last to First** | Go from last place to first in one round | +$3,000 |
| **Wrong is Right** | Find the Wrong Answer of the Game | +question value |
| **The Contrarian** | Answer every question in a round wrong | +$500 (pity bonus) |

### Easter Egg UX
- Not announced beforehand — players discover them
- Pixel art celebration animation when triggered
- Host has special unique lines for each
- Shown in post-game recap

## Host Personality

### Character Profile
- **Name:** TBD (to be developed during implementation)
- **Personality:** Witty, sarcastic, pop-culture savvy, occasionally wholesome
- **Style:** Think a mix of Cookie Masterson meets a stand-up comedian
- **Tone:** Never mean-spirited, always funny. Punches up, not down.

### Host Behaviors
| Moment | Behavior |
|--------|----------|
| Game start | Greets players by name, makes a joke about the group |
| Question intro | Delivers the question with creative misdirection and humor |
| Correct answer | Praises the player, possibly backhanded compliment |
| Wrong answer | Gentle roast, funny comment about the wrong choice |
| Nobody answers | "Don't be wimps!" moment, calls out the leader |
| Streak | Acknowledges hot streaks or cold streaks |
| Power-up used | Comments on the sabotage, adds drama |
| Easter egg found | Excited, dramatic reveal |
| Game over | Crowns the winner, roasts the loser, memorable sign-off |

### Personalization Data Available to Host
- All player names
- Current scores and rankings
- Answer history (who got what right/wrong)
- Streaks (hot or cold)
- Power-up usage
- Time taken to answer
- How many games this group has played together (light tracking)

## Visual Design — Retro Pixel Art

### Color Palette
- Dark background (deep purple/navy)
- Neon accent colors (cyan, magenta, yellow, green)
- High contrast for mobile readability
- CRT scanline effect (subtle, toggleable)

### UI Elements
- Pixel art font for headings and scores
- Clean sans-serif for question text (readability > style)
- Animated pixel art host avatar (reacts to game events)
- Chunky buttons sized for mobile touch targets (min 48px)
- Score counter with slot-machine animation
- Timer bar with pixel segments that drain away

### Animations
- Question cards slide in with retro wipe transitions
- Correct answer: green flash + pixel confetti
- Wrong answer: red shake + pixel skull
- Power-up activation: screen-wide pixel effect
- Jack Attack: words zoom in and out with 8-bit energy
- Score changes: numbers roll like an arcade counter

## Audio Design

### Music
| Moment | Audio |
|--------|-------|
| Lobby waiting | Chill chiptune loop |
| Game intro | Upbeat chiptune fanfare |
| Question thinking | Medium-tempo tension loop |
| Last 5 seconds | Accelerated tempo + heartbeat |
| Correct answer | Bright chiptune sting |
| Wrong answer | Comic fail sting |
| Round transition | Dramatic chiptune bridge |
| Jack Attack | Fast-paced chiptune banger |
| Victory | Triumphant 8-bit fanfare |

### Sound Effects
- Button tap / selection
- Timer tick (final 5 seconds)
- Buzzer (Jack Attack)
- Power-up activation (unique per type)
- Score counting up/down
- Player join/leave lobby
- Easter egg discovery jingle

### Voice (ElevenLabs)
- All host dialogue is synthesized and played as audio
- Audio streams to clients via WebSocket or pre-fetched URLs
- Voice generates during question intro state (5-10s buffer time)
- Fallback to text display if voice fails or is slow
