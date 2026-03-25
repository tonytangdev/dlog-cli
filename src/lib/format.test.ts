import { describe, expect, it } from "bun:test";
import { formatDate, formatSearchResults, truncate } from "./format.js";

describe("truncate", () => {
	it("returns string unchanged if within maxLen", () => {
		expect(truncate("hello", 10)).toBe("hello");
	});

	it("returns string unchanged if exactly maxLen", () => {
		expect(truncate("hello", 5)).toBe("hello");
	});

	it("truncates with ... if over maxLen", () => {
		expect(truncate("hello world", 8)).toBe("hello...");
	});

	it("handles empty string", () => {
		expect(truncate("", 5)).toBe("");
	});

	it("handles maxLen less than 4 gracefully", () => {
		expect(truncate("hello", 3)).toBe("...");
	});
});

describe("formatDate", () => {
	it("formats ISO string as Mon DD", () => {
		expect(formatDate("2026-01-15T10:30:00.000Z")).toBe("Jan 15");
	});

	it("formats different month", () => {
		expect(formatDate("2026-03-05T00:00:00.000Z")).toBe("Mar 05");
	});

	it("formats December", () => {
		expect(formatDate("2025-12-25T12:00:00.000Z")).toBe("Dec 25");
	});
});

describe("formatSearchResults", () => {
	it("formats results as a table with header", () => {
		const results = [
			{
				id: "abc-123",
				rawText: "paymentProviderId in orders table because less complexity",
				project: "orders",
				outcome: null,
				reasoning: null,
				author: "tony",
				searchHitCount: 12,
				needsReview: false,
				createdAt: "2026-01-15T10:00:00.000Z",
			},
		];

		const output = formatSearchResults(results);
		expect(output).toContain("#");
		expect(output).toContain("Project");
		expect(output).toContain("Decision");
		expect(output).toContain("Date");
		expect(output).toContain("orders");
		expect(output).toContain("paymentProviderId in orders table");
		expect(output).toContain("Jan 15");
	});

	it("shows (none) for null project", () => {
		const results = [
			{
				id: "abc-123",
				rawText: "some decision",
				project: null,
				outcome: null,
				reasoning: null,
				author: null,
				searchHitCount: 0,
				needsReview: false,
				createdAt: "2026-03-10T00:00:00.000Z",
			},
		];

		const output = formatSearchResults(results);
		expect(output).toContain("(none)");
	});

	it("prefers outcome over rawText", () => {
		const results = [
			{
				id: "abc-123",
				rawText: "raw text here",
				project: null,
				outcome: "enriched outcome text",
				reasoning: null,
				author: null,
				searchHitCount: 0,
				needsReview: false,
				createdAt: "2026-03-10T00:00:00.000Z",
			},
		];

		const output = formatSearchResults(results);
		expect(output).toContain("enriched outcome text");
		expect(output).not.toContain("raw text here");
	});

	it("truncates long decision text", () => {
		const results = [
			{
				id: "abc-123",
				rawText: "a".repeat(60),
				project: null,
				outcome: null,
				reasoning: null,
				author: null,
				searchHitCount: 0,
				needsReview: false,
				createdAt: "2026-03-10T00:00:00.000Z",
			},
		];

		const output = formatSearchResults(results);
		expect(output).toContain("...");
	});

	it("numbers results starting at 1", () => {
		const results = [
			{
				id: "a",
				rawText: "first",
				project: null,
				outcome: null,
				reasoning: null,
				author: null,
				searchHitCount: 0,
				needsReview: false,
				createdAt: "2026-01-01T00:00:00.000Z",
			},
			{
				id: "b",
				rawText: "second",
				project: null,
				outcome: null,
				reasoning: null,
				author: null,
				searchHitCount: 0,
				needsReview: false,
				createdAt: "2026-01-02T00:00:00.000Z",
			},
		];

		const output = formatSearchResults(results);
		const lines = output.split("\n");
		// Line 0 is header, line 1+ are data rows with right-aligned index
		expect(lines[1]).toMatch(/^\s+1\s/);
		expect(lines[2]).toMatch(/^\s+2\s/);
	});
});
