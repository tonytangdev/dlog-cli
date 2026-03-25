import { getDb } from "./db.js";

export interface SearchResult {
	id: string;
	rawText: string;
	project: string | null;
	outcome: string | null;
	reasoning: string | null;
	alternatives: string[] | null;
	tags: string[] | null;
	status: string;
	createdAt: string; // ISO string
}

export interface SearchOptions {
	limit?: number;
	status?: "active" | "archived";
}

interface RawRow {
	id: string;
	raw_text: string;
	project: string | null;
	outcome: string | null;
	reasoning: string | null;
	alternatives: string | null;
	tags: string | null;
	status: string;
	created_at: number;
	rank: number;
}

function mapRow(row: RawRow): SearchResult {
	return {
		id: row.id,
		rawText: row.raw_text,
		project: row.project,
		outcome: row.outcome,
		reasoning: row.reasoning,
		alternatives: row.alternatives
			? (JSON.parse(row.alternatives) as string[])
			: null,
		tags: row.tags ? (JSON.parse(row.tags) as string[]) : null,
		status: row.status,
		createdAt: new Date(row.created_at * 1000).toISOString(),
	};
}

export function searchDecisions(
	query: string,
	options: SearchOptions = {},
): SearchResult[] {
	const { limit = 5, status = "active" } = options;

	const ftsQuery = query
		.split(/\s+/)
		.filter(Boolean)
		.map((term) => `"${term}"*`)
		.join(" ");

	const db = getDb();
	// biome-ignore lint/suspicious/noExplicitAny: $client type differs between bun-sqlite and better-sqlite3
	const sqlite = (db as any).$client;

	const stmt = sqlite.prepare(`
    SELECT d.id, d.raw_text, d.project, d.outcome, d.reasoning,
           d.alternatives, d.tags, d.status, d.created_at,
           rank
    FROM decisions_fts fts
    JOIN decisions d ON d.rowid = fts.rowid
    WHERE decisions_fts MATCH ?
      AND d.status = ?
    ORDER BY rank
    LIMIT ?
  `);

	const rows = stmt.all(ftsQuery, status, limit) as RawRow[];
	return rows.map(mapRow);
}
