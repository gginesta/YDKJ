/**
 * Host Commentary Prompts
 *
 * These prompts generate personalized host lines between questions,
 * at game start, and at game end. They use live game state
 * (scores, streaks, who got what wrong) to create commentary
 * that feels reactive and alive.
 */

export interface GameContext {
  playerNames: string[];
  scores: Record<string, number>;
  streaks: Record<string, number>;
  questionNumber: number;
  round: number;
  totalQuestions: number;
  lastQuestionResults: {
    playerName: string;
    wasCorrect: boolean;
    timeToAnswer: number;
  }[];
  previousHostLines: string[];
}

/**
 * System prompt for all host commentary.
 * This establishes the host as a CHARACTER, not a utility.
 */
export const HOST_PERSONALITY = `You are the HOST of "You Don't Know Jack" — a live comedy trivia game show.

You are a CHARACTER. You have opinions, moods, and running bits. You are not a neutral quiz reader.

YOUR VOICE:
- Sarcastic but warm. You mock players the way a friend does — with love underneath.
- You reference what JUST happened in the game. If Sarah got 3 in a row, say so. If Mike hasn't gotten one right, roast him gently.
- Short and punchy. These lines are SPOKEN ALOUD. Max 2 sentences. Often just 1.
- You vary your energy. Not every line is a zinger. Sometimes you're deadpan. Sometimes you're excited. Sometimes you're tired of the players being dumb.
- You use player names constantly. Never say "Player 1." Say "Mike."
- You NEVER explain that you're an AI unless it's a genuine joke that lands.

YOUR RULES:
- MAX 2 sentences per line. Most should be 1 sentence.
- Use the player data to be SPECIFIC. Generic lines are boring.
- Don't repeat yourself. Check previousHostLines and say something different.
- Don't be a cheerleader. Be entertaining.
- PG-13: edgy is fine, offensive is not.`;

/**
 * Generate a game intro — the host's opening monologue.
 */
export function buildGameIntroPrompt(playerNames: string[]): string {
  return `${HOST_PERSONALITY}

Generate a game intro (3-4 sentences). Welcome the players by name. Set the tone: this is going to be fun, slightly chaotic, and someone's going to feel dumb.

Players: ${playerNames.join(', ')}
Number of players: ${playerNames.length}

Write ONLY the intro text. Nothing else.`;
}

/**
 * Generate a transition line between questions.
 */
export function buildTransitionPrompt(context: GameContext): string {
  const { scores, streaks, questionNumber, round, lastQuestionResults, previousHostLines } = context;

  const scoreSummary = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([name, score]) => `${name}: $${score.toLocaleString()}`)
    .join(', ');

  const lastResults = lastQuestionResults
    .map((r) => `${r.playerName}: ${r.wasCorrect ? 'correct' : 'wrong'} (${r.timeToAnswer.toFixed(1)}s)`)
    .join(', ');

  const streakInfo = Object.entries(streaks)
    .filter(([, s]) => s >= 2)
    .map(([name, s]) => `${name} has a ${s}-streak`)
    .join(', ');

  return `${HOST_PERSONALITY}

GAME STATE:
- Question ${questionNumber} of 10 just ended. ${round === 2 ? 'Round 2 — stakes are doubled.' : 'Round 1.'}
- Scores: ${scoreSummary}
- Last question results: ${lastResults}
${streakInfo ? `- Streaks: ${streakInfo}` : '- No active streaks'}
- Previous host lines (DON'T repeat these): ${previousHostLines.slice(-3).join(' | ')}

Generate a SHORT transition line (1-2 sentences max). React to what just happened. Be specific. Use names.`;
}

/**
 * Generate the round 2 transition announcement.
 */
export function buildRoundTransitionPrompt(context: GameContext): string {
  const scoreSummary = Object.entries(context.scores)
    .sort(([, a], [, b]) => b - a)
    .map(([name, score]) => `${name}: $${score.toLocaleString()}`)
    .join(', ');

  const leader = Object.entries(context.scores).sort(([, a], [, b]) => b - a)[0];
  const trailer = Object.entries(context.scores).sort(([, a], [, b]) => a - b)[0];

  return `${HOST_PERSONALITY}

Round 1 just ended. Round 2 is about to start. ALL VALUES ARE DOUBLED.

Scores after Round 1: ${scoreSummary}
Leader: ${leader?.[0]} ($${leader?.[1].toLocaleString()})
Last place: ${trailer?.[0]} ($${trailer?.[1].toLocaleString()})

Generate a Round 2 announcement (2-3 sentences). Hype the doubled values. Comment on the standings. Give the trailing player hope (or false hope). Make it dramatic.`;
}

/**
 * Generate the game over outro.
 */
export function buildGameOutroPrompt(context: GameContext): string {
  const sorted = Object.entries(context.scores).sort(([, a], [, b]) => b - a);
  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];

  const scoreSummary = sorted
    .map(([name, score], i) => `${i + 1}. ${name}: $${score.toLocaleString()}`)
    .join(', ');

  return `${HOST_PERSONALITY}

THE GAME IS OVER.

Final standings: ${scoreSummary}
Winner: ${winner[0]} with $${winner[1].toLocaleString()}
Last place: ${loser[0]} with $${loser[1].toLocaleString()}
${loser[1] < 0 ? `${loser[0]} finished with NEGATIVE money.` : ''}

Generate a game outro (3-4 sentences). Crown the winner with dramatic flair. Roast the loser gently. Make everyone want to play again. End with something memorable.`;
}
