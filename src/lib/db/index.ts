import Database from 'better-sqlite3';
import path from 'path';
import { createHash } from 'crypto';

let db: Database.Database | null = null;

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'ydkj.db');

/**
 * Get or create the SQLite database connection.
 * Auto-creates tables on first run.
 */
export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      player_names TEXT NOT NULL,
      final_scores TEXT NOT NULL,
      winner_name TEXT NOT NULL,
      question_count INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      theme TEXT,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS question_cache (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      question_data TEXT NOT NULL,
      times_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_names_hash TEXT NOT NULL,
      question_ids_seen TEXT NOT NULL,
      last_played DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

// ============================================================
// Query Helpers
// ============================================================

export interface GameResult {
  id?: number;
  room_code: string;
  player_names: string;
  final_scores: string;
  winner_name: string;
  question_count: number;
  duration_seconds: number;
  theme?: string;
  played_at?: string;
}

/**
 * Save a completed game result.
 */
export function saveGameResult(result: Omit<GameResult, 'id' | 'played_at'>): number {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO game_results (room_code, player_names, final_scores, winner_name, question_count, duration_seconds, theme)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    result.room_code,
    result.player_names,
    result.final_scores,
    result.winner_name,
    result.question_count,
    result.duration_seconds,
    result.theme || null
  );
  return info.lastInsertRowid as number;
}

/**
 * Get recent game results.
 */
export function getRecentGames(limit: number = 10): GameResult[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT * FROM game_results ORDER BY played_at DESC LIMIT ?
  `);
  return stmt.all(limit) as GameResult[];
}

/**
 * Cache a generated question.
 */
export function cacheQuestion(
  id: string,
  type: string,
  category: string,
  questionData: string,
  expiresAt: string
): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO question_cache (id, type, category, question_data, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, type, category, questionData, expiresAt);
}

/**
 * Get a cached question by ID.
 */
export function getCachedQuestion(id: string): { question_data: string } | undefined {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT question_data FROM question_cache
    WHERE id = ? AND expires_at > datetime('now')
  `);
  return stmt.get(id) as { question_data: string } | undefined;
}

// ============================================================
// Player Group / Question Deduplication
// ============================================================

/**
 * Get a hash for a group of player names (sorted, lowercased, joined).
 */
export function hashPlayerGroup(playerNames: string[]): string {
  const normalized = playerNames.map((n) => n.toLowerCase().trim()).sort().join(',');
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Record that a player group has seen specific question IDs.
 * Appends to any existing seen list for this group.
 */
export function recordSeenQuestions(playerNamesHash: string, questionIds: string[]): void {
  const database = getDb();
  const existing = database.prepare(
    `SELECT id, question_ids_seen FROM player_groups WHERE player_names_hash = ?`
  ).get(playerNamesHash) as { id: number; question_ids_seen: string } | undefined;

  if (existing) {
    let seen: string[] = [];
    try {
      seen = JSON.parse(existing.question_ids_seen);
    } catch {
      seen = [];
    }
    const merged = Array.from(new Set([...seen, ...questionIds]));
    database.prepare(
      `UPDATE player_groups SET question_ids_seen = ?, last_played = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(JSON.stringify(merged), existing.id);
  } else {
    database.prepare(
      `INSERT INTO player_groups (player_names_hash, question_ids_seen) VALUES (?, ?)`
    ).run(playerNamesHash, JSON.stringify(questionIds));
  }
}

/**
 * Get all question IDs that a player group has already seen.
 */
export function getSeenQuestionIds(playerNamesHash: string): string[] {
  const database = getDb();
  const row = database.prepare(
    `SELECT question_ids_seen FROM player_groups WHERE player_names_hash = ?`
  ).get(playerNamesHash) as { question_ids_seen: string } | undefined;

  if (!row) return [];

  try {
    const parsed = JSON.parse(row.question_ids_seen);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Reset the seen questions for a player group (when they've exhausted the pool).
 */
function resetSeenQuestions(playerNamesHash: string): void {
  const database = getDb();
  database.prepare(
    `UPDATE player_groups SET question_ids_seen = '[]', last_played = CURRENT_TIMESTAMP WHERE player_names_hash = ?`
  ).run(playerNamesHash);
}

export { resetSeenQuestions };

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
