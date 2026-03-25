import { describe, expect, it, spyOn } from "bun:test";
import * as inquirer from "@inquirer/prompts";
import { editAlternatives } from "./prompts.js";

describe("editAlternatives", () => {
	it("should return empty array when starting with no alternatives and selecting done", async () => {
		const selectSpy = spyOn(inquirer, "select").mockResolvedValueOnce("done");

		const result = await editAlternatives([]);

		expect(result).toEqual([]);
		selectSpy.mockRestore();
	});

	it("should add a new alternative", async () => {
		const selectSpy = spyOn(inquirer, "select")
			.mockResolvedValueOnce("add")
			.mockResolvedValueOnce("done");
		const inputSpy = spyOn(inquirer, "input").mockResolvedValueOnce(
			"New alternative",
		);

		const result = await editAlternatives([]);

		expect(result).toEqual(["New alternative"]);
		selectSpy.mockRestore();
		inputSpy.mockRestore();
	});

	it("should edit an existing alternative", async () => {
		const selectSpy = spyOn(inquirer, "select")
			.mockResolvedValueOnce("edit:0")
			.mockResolvedValueOnce("done");
		const inputSpy = spyOn(inquirer, "input").mockResolvedValueOnce(
			"Edited alternative",
		);

		const result = await editAlternatives(["Original"]);

		expect(result).toEqual(["Edited alternative"]);
		selectSpy.mockRestore();
		inputSpy.mockRestore();
	});

	it("should delete an alternative", async () => {
		const selectSpy = spyOn(inquirer, "select")
			.mockResolvedValueOnce("delete:0")
			.mockResolvedValueOnce("done");

		const result = await editAlternatives(["To delete", "Keep"]);

		expect(result).toEqual(["Keep"]);
		selectSpy.mockRestore();
	});
});
