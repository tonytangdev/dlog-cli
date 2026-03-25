import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("log command", () => {
	let tmpDir: string;
	let logSpy: ReturnType<typeof spyOn>;
	let errorSpy: ReturnType<typeof spyOn>;
	let exitSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "dlog-log-test-"));
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

	function getAllDecisions() {
		const { getDb } = require("../lib/db.js");
		const { decisions } = require("../lib/schema.js");
		const db = getDb();
		return db.select().from(decisions).all();
	}

	async function runLog(...args: string[]) {
		const { createLogCommand } = require("./log.js");
		const cmd = createLogCommand();
		await cmd.parseAsync(["node", "test", ...args]);
	}

	it("logs decision with inline text", async () => {
		await runLog("use postgres");
		const rows = getAllDecisions();
		expect(rows).toHaveLength(1);
		expect(rows[0].rawText).toBe("use postgres");
		expect(logSpy.mock.calls[0][0]).toContain("Decision logged");
	});

	it("logs decision with all options", async () => {
		await runLog(
			"use postgres",
			"--project",
			"backend",
			"--outcome",
			"adopted",
			"--reasoning",
			"best fit",
			"--alternatives",
			"mysql,sqlite",
			"--tags",
			"db,infra",
		);
		const rows = getAllDecisions();
		expect(rows).toHaveLength(1);
		const row = rows[0];
		expect(row.rawText).toBe("use postgres");
		expect(row.project).toBe("backend");
		expect(row.outcome).toBe("adopted");
		expect(row.reasoning).toBe("best fit");
		expect(row.alternatives).toBe(JSON.stringify(["mysql", "sqlite"]));
		expect(row.tags).toBe(JSON.stringify(["db", "infra"]));
	});

	it("splits comma-separated alternatives into JSON array", async () => {
		await runLog("decide", "--alternatives", "a,b,c");
		const row = getAllDecisions()[0];
		expect(JSON.parse(row.alternatives)).toEqual(["a", "b", "c"]);
	});

	it("splits comma-separated tags into JSON array", async () => {
		await runLog("decide", "--tags", "x,y,z");
		const row = getAllDecisions()[0];
		expect(JSON.parse(row.tags)).toEqual(["x", "y", "z"]);
	});

	it("trims whitespace from alternatives and tags", async () => {
		await runLog(
			"decide",
			"--alternatives",
			" foo , bar ",
			"--tags",
			" a , b ",
		);
		const row = getAllDecisions()[0];
		expect(JSON.parse(row.alternatives)).toEqual(["foo", "bar"]);
		expect(JSON.parse(row.tags)).toEqual(["a", "b"]);
	});

	it("exits with error when no text provided", async () => {
		const origIsTTY = process.stdin.isTTY;
		Object.defineProperty(process.stdin, "isTTY", {
			value: true,
			configurable: true,
		});
		try {
			await expect(runLog()).rejects.toThrow("exit");
			expect(errorSpy.mock.calls[0][0]).toContain("no decision text");
			expect(exitSpy).toHaveBeenCalledWith(1);
		} finally {
			Object.defineProperty(process.stdin, "isTTY", {
				value: origIsTTY,
				configurable: true,
			});
		}
	});

	it("exits with error when text exceeds 10000 chars", async () => {
		const longText = "x".repeat(10001);
		await expect(runLog(longText)).rejects.toThrow("exit");
		expect(errorSpy.mock.calls[0][0]).toContain("exceeds 10,000");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("sets status to active", async () => {
		await runLog("decide something");
		const row = getAllDecisions()[0];
		expect(row.status).toBe("active");
	});

	it("generates unique UUIDs for each decision", async () => {
		await runLog("first");
		await runLog("second");
		const rows = getAllDecisions();
		expect(rows).toHaveLength(2);
		expect(rows[0].id).not.toBe(rows[1].id);
	});
});
