import type { Player } from '../../types/game';

/**
 * Calculate score for a question answer.
 * Correct: baseValue + speedBonus. Wrong: -50% baseValue. Timeout: 0.
 */
export function calculateScore(
  baseValue: number,
  isCorrect: boolean,
  timeRemainingMs: number,
  totalTimeMs: number
): { total: number; speedBonus: number } {
  if (timeRemainingMs <= 0 && !isCorrect) {
    // Timeout — no answer submitted
    return { total: 0, speedBonus: 0 };
  }

  if (!isCorrect) {
    return { total: -Math.round(baseValue * 0.5), speedBonus: 0 };
  }

  const speedRatio = Math.max(0, Math.min(1, timeRemainingMs / totalTimeMs));
  const speedBonus = Math.round(baseValue * 0.5 * speedRatio);
  return { total: baseValue + speedBonus, speedBonus };
}

/**
 * Update a player's streak. Returns the new streak value.
 */
export function updateStreak(currentStreak: number, isCorrect: boolean): number {
  return isCorrect ? currentStreak + 1 : 0;
}

/**
 * Get streak bonus money.
 * +$1,000 at streak 5, +$5,000 for perfect game (all 10 correct).
 */
export function getStreakBonus(streak: number, totalAnswered: number): number {
  let bonus = 0;
  if (streak === 5) bonus += 1000;
  if (streak === 10 && totalAnswered === 10) bonus += 5000;
  return bonus;
}

/**
 * Assign dollar values for questions in a round.
 * Round 1: $1000, $1000, $2000, $2000, $3000
 * Round 2: doubled — $2000, $2000, $4000, $4000, $6000
 */
export function assignQuestionValues(round: number): number[] {
  const base = [1000, 1000, 2000, 2000, 3000];
  const multiplier = round >= 2 ? 2 : 1;
  return base.map((v) => v * multiplier);
}

/**
 * Find the leading player (highest money). Returns player or null.
 */
export function getLeadingPlayer(players: Player[]): Player | null {
  if (players.length === 0) return null;
  return players.reduce((leader, p) => (p.money > leader.money ? p : leader), players[0]);
}
