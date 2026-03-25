import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema.js";

const require = createRequire(import.meta.url);

// biome-ignore lint/suspicious/noExplicitAny: runtime detection requires dynamic types
let drizzleFn: any;
// biome-ignore lint/suspicious/noExplicitAny: runtime detection requires dynamic types
let DatabaseConstructor: any;

function initDriver() {
	if (drizzleFn) return;

	if (typeof globalThis.Bun !== "undefined") {
		// Bun runtime — use bun:sqlite
		const bunSqlite = require("bun:sqlite");
		DatabaseConstructor = bunSqlite.Database;
		drizzleFn = require("drizzle-orm/bun-sqlite").drizzle;
	} else {
		// Node runtime — use better-sqlite3
		DatabaseConstructor = require("better-sqlite3");
		drizzleFn = require("drizzle-orm/better-sqlite3").drizzle;
	}
}

// biome-ignore lint/suspicious/noExplicitAny: both bun-sqlite and better-sqlite3 drivers share the same interface
export type DbInstance = BaseSQLiteDatabase<"sync", any, typeof schema>;

function getDbPath(): string {
	const configDir = process.env.DLOG_CONFIG_DIR ?? join(homedir(), ".dlog");
	mkdirSync(configDir, { recursive: true });
	return join(configDir, "decisions.db");
}

function createDb(dbPath?: string) {
	initDriver();
	const path = dbPath ?? getDbPath();
	const sqlite = new DatabaseConstructor(path);

	// WAL journal mode for better concurrent reads
	sqlite.exec("PRAGMA journal_mode = WAL");

	// Initialize schema
	sqlite.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      raw_text TEXT NOT NULL,
      project TEXT,
      outcome TEXT,
      reasoning TEXT,
      alternatives TEXT,
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      remote_id TEXT,
      last_synced_at INTEGER
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
      id UNINDEXED,
      raw_text,
      project,
      outcome,
      reasoning,
      alternatives,
      tags,
      content=decisions,
      content_rowid=rowid
    );

    CREATE TRIGGER IF NOT EXISTS decisions_fts_insert
    AFTER INSERT ON decisions BEGIN
      INSERT INTO decisions_fts(rowid, id, raw_text, project, outcome, reasoning, alternatives, tags)
      VALUES (new.rowid, new.id, new.raw_text, new.project, new.outcome, new.reasoning, new.alternatives, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS decisions_fts_delete
    AFTER DELETE ON decisions BEGIN
      INSERT INTO decisions_fts(decisions_fts, rowid, id, raw_text, project, outcome, reasoning, alternatives, tags)
      VALUES ('delete', old.rowid, old.id, old.raw_text, old.project, old.outcome, old.reasoning, old.alternatives, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS decisions_fts_update
    AFTER UPDATE ON decisions BEGIN
      INSERT INTO decisions_fts(decisions_fts, rowid, id, raw_text, project, outcome, reasoning, alternatives, tags)
      VALUES ('delete', old.rowid, old.id, old.raw_text, old.project, old.outcome, old.reasoning, old.alternatives, old.tags);
      INSERT INTO decisions_fts(rowid, id, raw_text, project, outcome, reasoning, alternatives, tags)
      VALUES (new.rowid, new.id, new.raw_text, new.project, new.outcome, new.reasoning, new.alternatives, new.tags);
    END;
  `);

	// Migration: drop sync-related tables from existing DBs
	sqlite.exec(`DROP TABLE IF EXISTS sync_meta`);

	return drizzleFn(sqlite, { schema }) as DbInstance;
}

// Singleton
let _db: DbInstance | null = null;

export function getDb(): DbInstance {
	if (!_db) {
		_db = createDb();
	}
	return _db;
}

/** Reset singleton — for testing only */
export function resetDb(): void {
	_db = null;
}
