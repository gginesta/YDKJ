import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

const DB_PATH = path.join(process.cwd(), 'ydkj.db');

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

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
