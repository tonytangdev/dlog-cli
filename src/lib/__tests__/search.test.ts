import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("searchDecisions", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "dlog-search-test-"));
		process.env.DLOG_CONFIG_DIR = tmpDir;
		const { resetDb, getDb } = require("../db.js");
		resetDb();
		getDb(); // initialize fresh DB
	});

	afterEach(() => {
		const { resetDb } = require("../db.js");
		resetDb();
		delete process.env.DLOG_CONFIG_DIR;
		rmSync(tmpDir, { recursive: true, force: true });
	});

	function insertDecision(
		overrides: {
			id?: string;
			rawText?: string;
			project?: string | null;
			outcome?: string | null;
			reasoning?: string | null;
			alternatives?: string[] | null;
			tags?: string[] | null;
			status?: "active" | "archived";
		} = {},
	) {
		const { getDb } = require("../db.js");
		const { decisions } = require("../schema.js");
		const db = getDb();
		const now = new Date();
		db.insert(decisions)
			.values({
				id: overrides.id ?? crypto.randomUUID(),
				rawText: overrides.rawText ?? "default decision text",
				project: overrides.project ?? null,
				outcome: overrides.outcome ?? null,
				reasoning: overrides.reasoning ?? null,
				alternatives: overrides.alternatives
					? JSON.stringify(overrides.alternatives)
					: null,
				tags: overrides.tags ? JSON.stringify(overrides.tags) : null,
				status: overrides.status ?? "active",
				createdAt: now,
				updatedAt: now,
			})
			.run();
	}

	it("finds decisions by keyword", () => {
		insertDecision({ rawText: "use postgres for the database" });
		insertDecision({ rawText: "deploy with kubernetes on AWS" });

		const { searchDecisions } = require("../search.js");
		const results = searchDecisions("postgres");
		expect(results).toHaveLength(1);
		expect(results[0].rawText).toBe("use postgres for the database");
	});

	it("respects limit", () => {
		for (let i = 0; i < 5; i++) {
			insertDecision({ rawText: `migration decision number ${i}` });
		}

		const { searchDecisions } = require("../search.js");
		const results = searchDecisions("migration", { limit: 2 });
		expect(results).toHaveLength(2);
	});

	it("excludes archived by default", () => {
		insertDecision({ rawText: "use redis for caching", status: "active" });
		insertDecision({ rawText: "use redis for sessions", status: "archived" });

		const { searchDecisions } = require("../search.js");
		const results = searchDecisions("redis");
		expect(results).toHaveLength(1);
		expect(results[0].rawText).toBe("use redis for caching");
	});

	it("can search archived with status: archived", () => {
		insertDecision({ rawText: "use redis for caching", status: "active" });
		insertDecision({ rawText: "use redis for sessions", status: "archived" });

		const { searchDecisions } = require("../search.js");
		const results = searchDecisions("redis", { status: "archived" });
		expect(results).toHaveLength(1);
		expect(results[0].rawText).toBe("use redis for sessions");
	});

	it("supports prefix matching", () => {
		insertDecision({ rawText: "adopt typescript for type safety" });
		insertDecision({ rawText: "unrelated decision about deployment" });

		const { searchDecisions } = require("../search.js");
		const results = searchDecisions("type"); // prefix matches "typescript" and "type"
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(
			results.some((r: { rawText: string }) =>
				r.rawText.includes("typescript"),
			),
		).toBe(true);
	});
});
