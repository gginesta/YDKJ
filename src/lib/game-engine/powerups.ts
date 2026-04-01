/**
 * Power-Up System
 *
 * Auto-grants power-ups to trailing players every 3 questions.
 * Additional grant for players >$5,000 behind the leader.
 * Max 3 power-ups held at once per player.
 */

import type { Player, PowerUp, PowerUpType } from '../../types/game';

// ============================================================
// Power-Up Definitions
// ============================================================

const POWER_UP_DEFS: Record<PowerUpType, Omit<PowerUp, 'type'>> = {
  time_steal: {
    name: 'Time Steal',
    description: 'Opponents lose 5 seconds from their timer',
    icon: '⏰',
  },
  double_down: {
    name: 'Double Down',
    description: 'Double your score on the next question (risk: double penalty too!)',
    icon: '🎲',
  },
  fake_answer: {
    name: 'Fake Answer',
    description: 'Inject a convincing fake 5th option for opponents',
    icon: '🃏',
  },
  point_leech: {
    name: 'Point Leech',
    description: 'If correct, steal 10% of the leader\'s money',
    icon: '🧛',
  },
  immunity: {
    name: 'Immunity',
    description: 'No penalty if you answer wrong',
    icon: '🛡️',
  },
  reveal: {
    name: 'Reveal',
    description: 'Eliminate one wrong answer before you choose',
    icon: '👁️',
  },
};

const ALL_POWER_UP_TYPES: PowerUpType[] = [
  'time_steal',
  'double_down',
  'fake_answer',
  'point_leech',
  'immunity',
  'reveal',
];

const MAX_POWER_UPS = 3;
const GRANT_INTERVAL = 3; // every N questions
const CATCH_UP_THRESHOLD = 5000; // $ behind leader to get extra

// ============================================================
// Power-Up Factory
// ============================================================

export function createPowerUp(type: PowerUpType): PowerUp {
  return { type, ...POWER_UP_DEFS[type] };
}

function getRandomPowerUpType(): PowerUpType {
  return ALL_POWER_UP_TYPES[Math.floor(Math.random() * ALL_POWER_UP_TYPES.length)];
}

// ============================================================
// Granting Logic
// ============================================================

/**
 * Determine which players should receive power-ups after a question.
 * Called after each question reveal.
 *
 * @param questionNumber 1-based question number just completed
 * @param players All players in the game
 * @returns Array of { playerId, powerUp } grants
 */
export function checkPowerUpGrants(
  questionNumber: number,
  players: Player[]
): { playerId: string; powerUp: PowerUp }[] {
  if (players.length < 2) return [];

  const grants: { playerId: string; powerUp: PowerUp }[] = [];

  // Sort by money descending
  const sorted = [...players].sort((a, b) => b.money - a.money);
  const leaderMoney = sorted[0].money;

  // Every 3 questions: grant to bottom 2 players
  if (questionNumber % GRANT_INTERVAL === 0) {
    const bottom2 = sorted.slice(-2).reverse(); // lowest first
    for (const player of bottom2) {
      if (player.powerUps.length < MAX_POWER_UPS) {
        const pu = createPowerUp(getRandomPowerUpType());
        grants.push({ playerId: player.id, powerUp: pu });
      }
    }
  }

  // Catch-up grant: any player >$5000 behind leader
  for (const player of sorted.slice(1)) {
    if (leaderMoney - player.money > CATCH_UP_THRESHOLD) {
      if (player.powerUps.length < MAX_POWER_UPS) {
        // Don't double-grant if already getting one this round
        if (!grants.find((g) => g.playerId === player.id)) {
          const pu = createPowerUp(getRandomPowerUpType());
          grants.push({ playerId: player.id, powerUp: pu });
        }
      }
    }
  }

  return grants;
}

// ============================================================
// Power-Up Effects
// ============================================================

export interface PowerUpEffect {
  type: PowerUpType;
  playerId: string;
  description: string;
}

/**
 * Active power-up effects for the current question.
 * Tracks which players have active modifiers.
 */
export class ActivePowerUps {
  private effects: Map<string, { type: PowerUpType; playerId: string }[]> = new Map();

  /**
   * Activate a power-up for a player. Removes it from their inventory.
   * Returns the effect description, or null if invalid.
   */
  activate(player: Player, powerUpType: PowerUpType): PowerUpEffect | null {
    const idx = player.powerUps.findIndex((p) => p.type === powerUpType);
    if (idx === -1) return null;

    // Remove from inventory
    player.powerUps.splice(idx, 1);

    // Record active effect
    const effect = { type: powerUpType, playerId: player.id };
    const existing = this.effects.get(player.id) || [];
    existing.push(effect);
    this.effects.set(player.id, existing);

    const def = POWER_UP_DEFS[powerUpType];
    return {
      type: powerUpType,
      playerId: player.id,
      description: `${player.name} used ${def.name}!`,
    };
  }

  /** Check if a player has an active effect of the given type */
  hasEffect(playerId: string, type: PowerUpType): boolean {
    return (this.effects.get(playerId) || []).some((e) => e.type === type);
  }

  /** Get all active effects */
  getAll(): PowerUpEffect[] {
    const result: PowerUpEffect[] = [];
    for (const [playerId, effects] of this.effects) {
      for (const e of effects) {
        result.push({
          type: e.type,
          playerId,
          description: POWER_UP_DEFS[e.type].name,
        });
      }
    }
    return result;
  }

  /** Get time_steal targets (everyone except the user) */
  getTimeStolenFrom(players: Player[]): string[] {
    const stealers = new Set<string>();
    for (const [playerId, effects] of this.effects) {
      if (effects.some((e) => e.type === 'time_steal')) {
        stealers.add(playerId);
      }
    }
    if (stealers.size === 0) return [];
    return players.filter((p) => !stealers.has(p.id)).map((p) => p.id);
  }

  /** Get which wrong answer to reveal for a player using 'reveal' */
  getRevealIndex(correctIndex: number, totalChoices: number): number {
    // Pick a random wrong answer to eliminate
    const wrongIndices = [];
    for (let i = 0; i < totalChoices; i++) {
      if (i !== correctIndex) wrongIndices.push(i);
    }
    return wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
  }

  /** Calculate score modifier for a player */
  getScoreMultiplier(playerId: string): number {
    if (this.hasEffect(playerId, 'double_down')) return 2;
    return 1;
  }

  /** Check if player has immunity (no wrong penalty) */
  hasImmunity(playerId: string): boolean {
    return this.hasEffect(playerId, 'immunity');
  }

  /** Calculate point leech amount */
  getPointLeechAmount(playerId: string, leaderMoney: number): number {
    if (!this.hasEffect(playerId, 'point_leech')) return 0;
    return Math.round(leaderMoney * 0.1);
  }

  /** Reset for next question */
  clear(): void {
    this.effects.clear();
  }
}

export function getPowerUpDef(type: PowerUpType): PowerUp {
  return { type, ...POWER_UP_DEFS[type] };
}

export function getHostReactionForPowerUp(playerName: string, type: PowerUpType): string {
  switch (type) {
    case 'time_steal':
      return `${playerName} just stole 5 seconds from everyone! That's cold.`;
    case 'double_down':
      return `${playerName} is going double or nothing! Bold move.`;
    case 'fake_answer':
      return `${playerName} slipped in a fake answer. Good luck figuring out which one!`;
    case 'point_leech':
      return `${playerName} is leeching points from the leader. Ruthless.`;
    case 'immunity':
      return `${playerName} activated a shield. No penalty this round!`;
    case 'reveal':
      return `${playerName} peeked behind the curtain and eliminated a wrong answer.`;
    default:
      return `${playerName} used a power-up!`;
  }
}
