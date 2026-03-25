import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveIndex, saveLastResults } from "../result-cache.js";

describe("result-cache", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "dlog-cache-test-"));
		process.env.DLOG_CONFIG_DIR = tmpDir;
	});

	afterEach(() => {
		delete process.env.DLOG_CONFIG_DIR;
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("saves and resolves index 1", async () => {
		await saveLastResults(["a", "b", "c"]);
		expect(await resolveIndex(1)).toBe("a");
	});

	it("resolves last index", async () => {
		await saveLastResults(["a", "b", "c"]);
		expect(await resolveIndex(3)).toBe("c");
	});

	it("returns null for out-of-bounds index", async () => {
		await saveLastResults(["a"]);
		expect(await resolveIndex(5)).toBeNull();
	});

	it("returns null when no cache file exists", async () => {
		expect(await resolveIndex(1)).toBeNull();
	});

	it("overwrites previous cache", async () => {
		await saveLastResults(["x"]);
		await saveLastResults(["y", "z"]);
		expect(await resolveIndex(1)).toBe("y");
	});

	it("handles empty array", async () => {
		await saveLastResults([]);
		expect(await resolveIndex(1)).toBeNull();
	});
});
