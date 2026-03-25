import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createListCommand } from "./list.js";
import { createSearchCommand } from "./search.js";

mock.module("@inquirer/prompts", () => ({
	select: () => Promise.resolve("quit"),
}));

let tmpDir: string;
let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;
let exitSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), "dlog-sl-test-"));
	process.env.DLOG_CONFIG_DIR = tmpDir;
	const { resetDb, getDb } = require("../lib/db.js");
	resetDb();
	getDb();
	logSpy = spyOn(console, "log").mockImplementation(() => {});
	errorSpy = spyOn(console, "error").mockImplementation(() => {});
	exitSpy = spyOn(process, "exit").mockImplementation(() => {
		throw new Error("exit");
	});
});

afterEach(() => {
	const { resetDb } = require("../lib/db.js");
	resetDb();
	delete process.env.DLOG_CONFIG_DIR;
	rmSync(tmpDir, { recursive: true, force: true });
	logSpy.mockRestore();
	errorSpy.mockRestore();
	exitSpy.mockRestore();
});

function insertDecision(
	overrides: {
		rawText?: string;
		project?: string | null;
		status?: string;
		outcome?: string | null;
	} = {},
) {
	const { getDb } = require("../lib/db.js");
	const { decisions } = require("../lib/schema.js");
	const db = getDb();
	const id = crypto.randomUUID();
	const now = new Date();
	db.insert(decisions)
		.values({
			id,
			rawText: overrides.rawText ?? "test decision",
			project: overrides.project ?? null,
			outcome: overrides.outcome ?? null,
			reasoning: null,
			alternatives: null,
			tags: null,
			status: overrides.status ?? "active",
			createdAt: now,
			updatedAt: now,
		})
		.run();
	return id;
}

describe("search command", () => {
	it("finds matching decisions", async () => {
		insertDecision({ rawText: "use postgres for storage" });
		insertDecision({ rawText: "adopt react for frontend" });

		const cmd = createSearchCommand();
		await cmd.parseAsync(["node", "test", "postgres"]);

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("postgres");
		expect(output).toContain("1 result found");
	});

	it("outputs no-results message", async () => {
		const cmd = createSearchCommand();
		await cmd.parseAsync(["node", "test", "nonexistent"]);

		expect(logSpy.mock.calls[0][0]).toContain("No decisions found.");
	});

	it("respects --limit", async () => {
		insertDecision({ rawText: "postgres option one" });
		insertDecision({ rawText: "postgres option two" });
		insertDecision({ rawText: "postgres option three" });

		const cmd = createSearchCommand();
		await cmd.parseAsync(["node", "test", "postgres", "--limit", "1"]);

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("1 result found");
	});

	it("searches archived with --deleted", async () => {
		insertDecision({ rawText: "postgres active", status: "active" });
		insertDecision({ rawText: "postgres archived", status: "archived" });

		const cmd = createSearchCommand();
		await cmd.parseAsync(["node", "test", "postgres", "--deleted"]);

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("1 result found");
		expect(output).toContain("archived");
	});

	it("saves results to cache", async () => {
		insertDecision({ rawText: "postgres caching test" });

		const cmd = createSearchCommand();
		await cmd.parseAsync(["node", "test", "postgres"]);

		expect(existsSync(join(tmpDir, "last-results.json"))).toBe(true);
	});
});

describe("list command", () => {
	it("lists all active decisions", async () => {
		insertDecision({ rawText: "decision alpha" });
		insertDecision({ rawText: "decision beta" });
		insertDecision({ rawText: "decision gamma" });

		const cmd = createListCommand();
		await cmd.parseAsync(["node", "test"]);

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("alpha");
		expect(output).toContain("beta");
		expect(output).toContain("gamma");
	});

	it("outputs no-results message when empty", async () => {
		const cmd = createListCommand();
		await cmd.parseAsync(["node", "test"]);

		expect(logSpy.mock.calls[0][0]).toContain("No decisions found.");
	});

	it("filters by project", async () => {
		insertDecision({ rawText: "backend task", project: "backend" });
		insertDecision({ rawText: "frontend task", project: "frontend" });

		const cmd = createListCommand();
		await cmd.parseAsync(["node", "test", "--project", "backend"]);

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("backend");
		expect(output).not.toContain("frontend task");
	});

	it("shows archived with --deleted", async () => {
		insertDecision({ rawText: "active item", status: "active" });
		insertDecision({ rawText: "archived item", status: "archived" });

		const cmd = createListCommand();
		await cmd.parseAsync(["node", "test", "--deleted"]);

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("archived item");
		expect(output).not.toContain("active item");
	});

	it("respects --limit", async () => {
		insertDecision({ rawText: "item one" });
		insertDecision({ rawText: "item two" });
		insertDecision({ rawText: "item three" });

		const cmd = createListCommand();
		await cmd.parseAsync(["node", "test", "--limit", "2"]);

		const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
		expect(output).toContain("Page 1 of 2");
	});
});
