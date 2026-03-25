import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createViewCommand } from "./view.js";

let tmpDir: string;
let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;
let exitSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), "dlog-view-test-"));
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
	logSpy.mockRestore();
	errorSpy.mockRestore();
	exitSpy.mockRestore();
	const { resetDb } = require("../lib/db.js");
	resetDb();
	delete process.env.DLOG_CONFIG_DIR;
	rmSync(tmpDir, { recursive: true, force: true });
});

function insertDecision(
	overrides: {
		id?: string;
		rawText?: string;
		status?: string;
		project?: string | null;
		outcome?: string | null;
		reasoning?: string | null;
		alternatives?: string | null;
		tags?: string | null;
	} = {},
) {
	const { getDb } = require("../lib/db.js");
	const { decisions } = require("../lib/schema.js");
	const db = getDb();
	const now = new Date();
	db.insert(decisions)
		.values({
			id: overrides.id ?? crypto.randomUUID(),
			rawText: overrides.rawText ?? "test decision",
			project: overrides.project ?? null,
			outcome: overrides.outcome ?? null,
			reasoning: overrides.reasoning ?? null,
			alternatives: overrides.alternatives ?? null,
			tags: overrides.tags ?? null,
			status: overrides.status ?? "active",
			createdAt: now,
			updatedAt: now,
		})
		.run();
}

describe("view command", () => {
	it("displays decision detail by UUID", async () => {
		const uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
		insertDecision({ id: uuid, rawText: "my important decision" });

		const cmd = createViewCommand();
		await cmd.parseAsync(["node", "test", uuid]);

		expect(logSpy).toHaveBeenCalled();
		const output = logSpy.mock.calls[0]?.[0] as string;
		expect(output).toContain(uuid);
	});

	it("resolves numeric index via result cache", async () => {
		const uuid = "11111111-2222-3333-4444-555555555555";
		insertDecision({ id: uuid, rawText: "cached decision" });

		const cacheFile = join(tmpDir, "last-results.json");
		writeFileSync(cacheFile, JSON.stringify([uuid]), "utf8");

		const cmd = createViewCommand();
		await cmd.parseAsync(["node", "test", "1"]);

		expect(logSpy).toHaveBeenCalled();
		const output = logSpy.mock.calls[0]?.[0] as string;
		expect(output).toContain(uuid);
	});

	it("exits with error for non-existent UUID", async () => {
		const uuid = "deadbeef-dead-beef-dead-beefdeadbeef";
		const cmd = createViewCommand();

		try {
			await cmd.parseAsync(["node", "test", uuid]);
		} catch {}

		expect(errorSpy).toHaveBeenCalled();
		const msg = errorSpy.mock.calls[0]?.[0] as string;
		expect(msg).toContain("not found");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("exits with error for archived decision", async () => {
		const uuid = "aaaaaaaa-1111-2222-3333-444444444444";
		insertDecision({ id: uuid, status: "archived" });

		const cmd = createViewCommand();

		try {
			await cmd.parseAsync(["node", "test", uuid]);
		} catch {}

		expect(errorSpy).toHaveBeenCalled();
		const msg = errorSpy.mock.calls[0]?.[0] as string;
		expect(msg).toContain("deleted");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("exits with error for invalid ref format", async () => {
		const cmd = createViewCommand();

		try {
			await cmd.parseAsync(["node", "test", "abc"]);
		} catch {}

		expect(errorSpy).toHaveBeenCalled();
		const msg = errorSpy.mock.calls[0]?.[0] as string;
		expect(msg).toContain("Invalid decision ID format");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("exits with error when index not in cache", async () => {
		const cacheFile = join(tmpDir, "last-results.json");
		writeFileSync(cacheFile, JSON.stringify([]), "utf8");

		const cmd = createViewCommand();

		try {
			await cmd.parseAsync(["node", "test", "99"]);
		} catch {}

		expect(errorSpy).toHaveBeenCalled();
		const msg = errorSpy.mock.calls[0]?.[0] as string;
		expect(msg).toContain("not found");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("displays all fields in detail view", async () => {
		const uuid = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
		insertDecision({
			id: uuid,
			rawText: "use postgres for storage",
			project: "backend",
			outcome: "chose postgres",
			reasoning: "better performance",
			alternatives: JSON.stringify(["mysql", "sqlite"]),
			tags: JSON.stringify(["database", "infrastructure"]),
		});

		const cmd = createViewCommand();
		await cmd.parseAsync(["node", "test", uuid]);

		expect(logSpy).toHaveBeenCalled();
		const output = logSpy.mock.calls[0]?.[0] as string;
		expect(output).toContain(uuid);
		expect(output).toContain("backend");
		expect(output).toContain("chose postgres");
		expect(output).toContain("better performance");
		expect(output).toContain("mysql");
		expect(output).toContain("sqlite");
		expect(output).toContain("database");
		expect(output).toContain("infrastructure");
	});
});
