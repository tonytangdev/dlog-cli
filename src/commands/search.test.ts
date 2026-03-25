import { describe, expect, it } from "bun:test";
import { createSearchCommand } from "./search.js";

describe("createSearchCommand", () => {
	it("creates a command named search", () => {
		const cmd = createSearchCommand();
		expect(cmd.name()).toBe("search");
	});

	it("has a required query argument", () => {
		const cmd = createSearchCommand();
		const args = cmd.registeredArguments;
		expect(args.length).toBeGreaterThanOrEqual(1);
		expect(args[0]?.name()).toBe("query");
		expect(args[0]?.required).toBe(true);
	});

	it("has a --limit option defaulting to 5", () => {
		const cmd = createSearchCommand();
		const opt = cmd.options.find((o) => o.long === "--limit");
		expect(opt).toBeDefined();
		expect(opt?.defaultValue).toBe(5);
	});
});
