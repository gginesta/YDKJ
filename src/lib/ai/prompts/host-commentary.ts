/**
 * System prompt for the host personality.
 * Used for personalized between-question commentary.
 */
export const HOST_PERSONALITY_SYSTEM = `You are the host of "You Don't Know Jack" — a trivia game show where high culture and pop culture collide.

YOUR PERSONALITY:
- Quick-witted and sarcastic, but never cruel
- Pop culture encyclopedia — you reference movies, memes, music, and internet culture naturally
- You have a love-hate relationship with the players — you mock them when they're wrong but genuinely celebrate when they're right
- Signature catchphrases that develop over a game
- You get increasingly dramatic as stakes rise in Round 2

YOUR RULES:
- Keep lines SHORT — 1-3 sentences max. This is spoken aloud via TTS.
- ALWAYS use specific player names when commenting.
- Never explain the joke. If it's not funny, move on.
- Vary your energy — don't be at 100% every line.
- Be specific about what happened — don't be generic.`;

/**
 * Player context for commentary generation.
 */
export interface CommentaryContext {
  players: {
    name: string;
    money: number;
    streak: number;
    lastAnswerCorrect: boolean | null;
    connected: boolean;
  }[];
  questionNumber: number;
  totalQuestions: number;
  round: number;
  previousHostLines: string[];
}

/**
 * Build a prompt for transition commentary between questions.
 */
export function buildTransitionCommentary(ctx: CommentaryContext): string {
  const playerSummaries = ctx.players
    .filter((p) => p.connected)
    .map((p) => {
      const streakNote =
        p.streak >= 3 ? ` (${p.streak}-streak!)` : p.streak === 0 && p.lastAnswerCorrect === false ? ' (cold)' : '';
      const lastNote =
        p.lastAnswerCorrect === true
          ? 'just got it right'
          : p.lastAnswerCorrect === false
            ? 'just got it wrong'
            : 'no answer';
      return `- ${p.name}: $${p.money.toLocaleString()}, ${lastNote}${streakNote}`;
    })
    .join('\n');

  const recentLines =
    ctx.previousHostLines.length > 0
      ? `\nYOUR RECENT LINES (don't repeat yourself):\n${ctx.previousHostLines.map((l) => `- "${l}"`).join('\n')}`
      : '';

  return `Generate a SHORT (1-2 sentences) transition line between questions.

GAME STATE:
- Question ${ctx.questionNumber} of ${ctx.totalQuestions}, Round ${ctx.round}
- Players:
${playerSummaries}
${recentLines}

TONE GUIDE:
${ctx.round === 2 ? '- Round 2: higher stakes, more dramatic energy' : '- Round 1: building momentum, lighter tone'}
${ctx.questionNumber >= 8 ? '- Near the end: tension is high, be dramatic about the standings' : ''}

Respond with ONLY the host line. No quotes, no labels, just the line itself.`;
}

/**
 * Build a prompt for the round transition moment.
 */
export function buildRoundTransitionCommentary(ctx: CommentaryContext): string {
  const standings = ctx.players
    .filter((p) => p.connected)
    .sort((a, b) => b.money - a.money)
    .map((p, i) => `${i + 1}. ${p.name}: $${p.money.toLocaleString()}`)
    .join(', ');

  return `We just finished Round 1 and are transitioning to Round 2 where ALL VALUES ARE DOUBLED.

CURRENT STANDINGS: ${standings}

Generate a 2-3 sentence transition. Mention the standings, hype up the doubled values, and tease the trailing players about their chance to catch up.

Respond with ONLY the host line.`;
}

/**
 * Build a prompt for the game outro.
 */
export function buildGameOutroCommentary(
  winner: { name: string; money: number },
  loser: { name: string; money: number },
  allPlayers: { name: string; money: number }[]
): string {
  const standings = allPlayers
    .sort((a, b) => b.money - a.money)
    .map((p, i) => `${i + 1}. ${p.name}: $${p.money.toLocaleString()}`)
    .join(', ');

  return `The game is over! Generate a memorable 3-4 sentence outro.

FINAL STANDINGS: ${standings}
WINNER: ${winner.name} with $${winner.money.toLocaleString()}
LAST PLACE: ${loser.name} with $${loser.money.toLocaleString()}

Crown the winner, roast the loser (gently), and sign off with flair. ${loser.money < 0 ? `${loser.name} owes money — have fun with that.` : ''}

Respond with ONLY the host line.`;
}
