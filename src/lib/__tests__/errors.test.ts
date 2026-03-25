import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { handleCommandError } from "../errors.js";

describe("handleCommandError", () => {
	const exitSpy = spyOn(process, "exit").mockImplementation(() => {
		throw new Error("process.exit called");
	});
	const errorSpy = spyOn(console, "error").mockImplementation(() => {});

	afterEach(() => {
		exitSpy.mockClear();
		errorSpy.mockClear();
	});

	it("exits with 0 for ExitPromptError", () => {
		const err = new Error("prompt cancelled");
		err.name = "ExitPromptError";
		expect(() => handleCommandError(err, "test")).toThrow();
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("exits with 1 for generic errors", () => {
		expect(() => handleCommandError(new Error("boom"), "ctx")).toThrow();
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("logs error with context", () => {
		expect(() => handleCommandError(new Error("boom"), "testing")).toThrow();
		expect(errorSpy).toHaveBeenCalledWith("testing: Error: boom");
	});

	it("handles non-Error values", () => {
		expect(() => handleCommandError("oops", "ctx")).toThrow();
		expect(errorSpy).toHaveBeenCalledWith("ctx: oops");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});
