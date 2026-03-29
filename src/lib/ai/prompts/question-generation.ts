import type Anthropic from '@anthropic-ai/sdk';

/**
 * System prompt for question generation.
 * Establishes the YDKJ writing style and rules.
 */
export const QUESTION_GENERATION_SYSTEM = `You are the head writer for a trivia game show called "You Don't Know Jack."
Your job is to create entertaining, cleverly-worded trivia questions in the YDKJ style.

WRITING RULES:
- Questions should NEVER be asked directly. Always use misdirection, pop culture mashups, or absurd scenarios to frame the question.
- Wrong answers must be funny AND plausible. A great wrong answer makes the player second-guess themselves.
- The host intro should be a 2-4 sentence setup that's entertaining to listen to. It sets the tone for the question.
- Each question needs distinct host reactions for correct, wrong, and timeout scenarios.
- Keep host scripts SHORT — 1-3 sentences each. These are read aloud.
- Never explain the joke. If it needs explaining, write a better joke.
- Vary difficulty: mix easy, medium, and tricky questions within a game.
- Questions should cover a wide range: history, science, pop culture, language, food, geography, sports, arts, technology.

QUESTION STYLE EXAMPLES:
- Instead of "What is the capital of France?", ask: "If a baguette could vote, which city would it call its nation's seat of power?"
- Instead of "Who painted the Mona Lisa?", ask: "Which Renaissance artist spent years painting a woman who couldn't even be bothered to smile properly?"

ANSWER STYLE:
- The correct answer should not be obvious from the question framing.
- Wrong answers should be thematically related and humorous.
- At least one wrong answer should be a common misconception or sound plausible.
- At least one wrong answer should be funny/absurd but not immediately dismissible.`;

/**
 * Build the user message for question generation.
 */
export function buildQuestionGenerationMessage(
  playerNames: string[],
  theme?: string
): string {
  let msg = `Generate 12 multiple choice trivia questions for a YDKJ game. I need 10 for the game plus 2 backups.

PLAYERS IN THIS GAME: ${playerNames.join(', ')}

Use the players' names in host scripts where appropriate — address them directly, make jokes about them competing.`;

  if (theme) {
    msg += `\n\nTHEME: "${theme}" — All questions should relate to this theme. Be creative with the connections — not every question needs to be obviously about the theme.`;
  }

  msg += `

IMPORTANT:
- Each question must have a unique category (don't repeat categories).
- Vary the difficulty: ~4 easy, ~5 medium, ~3 tricky.
- Make the host intros genuinely entertaining — they're the star of the show.
- Wrong answers should be funny and plausible, not obviously wrong.

Call the generate_game_questions tool with all 12 questions.`;

  return msg;
}

/**
 * Tool definition for structured question output.
 * Uses Claude's tool_use for guaranteed schema compliance.
 */
export const QUESTION_GENERATION_TOOL: Anthropic.Messages.Tool = {
  name: 'generate_game_questions',
  description: 'Generate a full set of YDKJ-style trivia questions for one game session.',
  input_schema: {
    type: 'object' as const,
    properties: {
      questions: {
        type: 'array',
        description: '12 multiple choice questions (10 for the game + 2 backups)',
        items: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Question category (e.g., "Science", "Pop Culture", "History")',
            },
            prompt: {
              type: 'string',
              description: 'The question text — cleverly worded with misdirection, 20-80 words',
            },
            choices: {
              type: 'array',
              items: { type: 'string' },
              description: 'Exactly 4 answer choices. Index 0-3.',
              minItems: 4,
              maxItems: 4,
            },
            correctIndex: {
              type: 'number',
              description: 'Index (0-3) of the correct answer in the choices array',
            },
            hostIntro: {
              type: 'string',
              description: 'Host intro script — entertaining 2-4 sentence setup before the question appears. Sets the tone.',
            },
            hostCorrect: {
              type: 'string',
              description: 'Host reaction when a player answers correctly. 1-2 sentences. Can reference specific players.',
            },
            hostWrong: {
              type: 'string',
              description: 'Host reaction when a player answers incorrectly. 1-2 sentences. Gentle roast.',
            },
            hostTimeout: {
              type: 'string',
              description: 'Host reaction when nobody answers. 1-2 sentences. Disappointed/sarcastic.',
            },
          },
          required: [
            'category',
            'prompt',
            'choices',
            'correctIndex',
            'hostIntro',
            'hostCorrect',
            'hostWrong',
            'hostTimeout',
          ],
        },
      },
      gameIntro: {
        type: 'string',
        description: 'Opening monologue for the game host. 3-5 sentences. Greet players by name, set the tone, build excitement.',
      },
      gameOutro: {
        type: 'string',
        description: 'Closing monologue template. Use {winner} and {loser} as placeholders. 2-3 sentences.',
      },
    },
    required: ['questions', 'gameIntro', 'gameOutro'],
  },
};
