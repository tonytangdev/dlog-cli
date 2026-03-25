import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeleteCommand } from "./delete.js";
import { createRestoreCommand } from "./restore.js";

let tmpDir: string;
let exitSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), "dlog-dr-test-"));
	process.env.DLOG_CONFIG_DIR = tmpDir;
	const { resetDb, getDb } = require("../lib/db.js");
	resetDb();
	getDb();
});

afterEach(() => {
	const { resetDb } = require("../lib/db.js");
	resetDb();
	delete process.env.DLOG_CONFIG_DIR;
	rmSync(tmpDir, { recursive: true, force: true });
	exitSpy?.mockRestore();
});

function insertDecision(overrides: { id?: string; status?: string } = {}) {
	const { getDb } = require("../lib/db.js");
	const { decisions } = require("../lib/schema.js");
	const db = getDb();
	const id = overrides.id ?? crypto.randomUUID();
	db.insert(decisions)
		.values({
			id,
			rawText: "test decision",
			project: null,
			outcome: null,
			reasoning: null,
			alternatives: null,
			tags: null,
			status: overrides.status ?? "active",
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		.run();
	return id;
}

function getDecision(id: string) {
	const { getDb } = require("../lib/db.js");
	const { decisions } = require("../lib/schema.js");
	const { eq } = require("drizzle-orm");
	return getDb().select().from(decisions).where(eq(decisions.id, id)).get();
}

function writeCache(ids: string[]) {
	writeFileSync(join(tmpDir, "last-results.json"), JSON.stringify(ids));
}

describe("delete command", () => {
	it("soft-deletes a decision by UUID", async () => {
		const id = insertDecision();
		const cmd = createDeleteCommand();
		await cmd.parseAsync(["node", "test", id]);

		const row = getDecision(id);
		expect(row.status).toBe("archived");
		expect(row.deletedAt).not.toBeNull();
	});

	it("soft-deletes by numeric index", async () => {
		const id = insertDecision();
		writeCache([id]);
		const cmd = createDeleteCommand();
		await cmd.parseAsync(["node", "test", "1"]);

		const row = getDecision(id);
		expect(row.status).toBe("archived");
		expect(row.deletedAt).not.toBeNull();
	});

	it("deletes multiple decisions at once", async () => {
		const id1 = insertDecision();
		const id2 = insertDecision();
		const cmd = createDeleteCommand();
		await cmd.parseAsync(["node", "test", id1, id2]);

		const row1 = getDecision(id1);
		const row2 = getDecision(id2);
		expect(row1.status).toBe("archived");
		expect(row2.status).toBe("archived");
	});

	it("outputs deletion count", async () => {
		const id1 = insertDecision();
		const id2 = insertDecision();
		const logSpy = spyOn(console, "log");
		const cmd = createDeleteCommand();
		await cmd.parseAsync(["node", "test", id1, id2]);

		expect(logSpy).toHaveBeenCalledWith("Deleted 2 decision(s).");
		logSpy.mockRestore();
	});

	it("exits with error for invalid ref", async () => {
		exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit");
		});
		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		const cmd = createDeleteCommand();

		expect(cmd.parseAsync(["node", "test", "abc"])).rejects.toThrow("exit");
		expect(errSpy).toHaveBeenCalledWith("Invalid decision ID: abc");
		errSpy.mockRestore();
	});

	it("exits with error when index not in cache", async () => {
		exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit");
		});
		const errSpy = spyOn(console, "error").mockImplementation(() => {});
		const cmd = createDeleteCommand();

		expect(cmd.parseAsync(["node", "test", "99"])).rejects.toThrow("exit");
		expect(errSpy).toHaveBeenCalledWith(
			"Decision #99 not found. Run 'dlog search' or 'dlog list' first.",
		);
		errSpy.mockRestore();
	});
});

describe("restore command", () => {
	it("restores an archived decision by UUID", async () => {
		const id = insertDecision({ status: "archived" });
		const cmd = createRestoreCommand();
		await cmd.parseAsync(["node", "test", id]);

		const row = getDecision(id);
		expect(row.status).toBe("active");
		expect(row.deletedAt).toBeNull();
	});

	it("restores by numeric index", async () => {
		const id = insertDecision({ status: "archived" });
		writeCache([id]);
		const cmd = createRestoreCommand();
		await cmd.parseAsync(["node", "test", "1"]);

		const row = getDecision(id);
		expect(row.status).toBe("active");
	});

	it("outputs restoration count", async () => {
		const id = insertDecision({ status: "archived" });
		const logSpy = spyOn(console, "log");
		const cmd = createRestoreCommand();
		await cmd.parseAsync(["node", "test", id]);

		expect(logSpy).toHaveBeenCalledWith("Restored 1 decision(s).");
		logSpy.mockRestore();
	});
});
