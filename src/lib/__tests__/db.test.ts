import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("db module", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "dlog-test-"));
		process.env.DLOG_CONFIG_DIR = tmpDir;
		// Reset singleton so each test gets a fresh DB pointed at tmpDir
		const { resetDb } = require("../db.js");
		resetDb();
	});

	afterEach(() => {
		const { resetDb } = require("../db.js");
		resetDb();
		delete process.env.DLOG_CONFIG_DIR;
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("creates the DB file", () => {
		const { getDb } = require("../db.js");
		getDb();
		expect(existsSync(join(tmpDir, "decisions.db"))).toBe(true);
	});
});
