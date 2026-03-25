import { describe, expect, it } from "bun:test";
import { formatDecisionDetail } from "../format.js";

function makeDecision(overrides: Record<string, unknown> = {}) {
	return {
		id: "abc-123",
		project: null as string | null,
		status: "active" as const,
		rawText: "Use PostgreSQL for the main database",
		outcome: null as string | null,
		reasoning: null as string | null,
		alternatives: null as string[] | null,
		tags: null as string[] | null,
		createdAt: "2025-06-15T10:30:00Z",
		...overrides,
	};
}

describe("formatDecisionDetail", () => {
	it("includes decision ID", () => {
		const out = formatDecisionDetail(makeDecision());
		expect(out).toContain("abc-123");
	});

	it("includes project when present", () => {
		const out = formatDecisionDetail(makeDecision({ project: "backend" }));
		expect(out).toContain("Project:");
		expect(out).toContain("backend");
	});

	it("omits project line when null", () => {
		const out = formatDecisionDetail(makeDecision({ project: null }));
		expect(out).not.toContain("Project:");
	});

	it("includes status", () => {
		const out = formatDecisionDetail(makeDecision());
		expect(out).toContain("Status:");
		expect(out).toContain("active");
	});

	it("includes raw text", () => {
		const out = formatDecisionDetail(makeDecision());
		expect(out).toContain("Raw text:");
		expect(out).toContain("Use PostgreSQL for the main database");
	});

	it("includes outcome when present", () => {
		const out = formatDecisionDetail(
			makeDecision({ outcome: "Chose PostgreSQL" }),
		);
		expect(out).toContain("Outcome:");
		expect(out).toContain("Chose PostgreSQL");
	});

	it("includes reasoning when present", () => {
		const out = formatDecisionDetail(
			makeDecision({ reasoning: "Better performance" }),
		);
		expect(out).toContain("Reasoning:");
		expect(out).toContain("Better performance");
	});

	it("formats alternatives as bullet list", () => {
		const out = formatDecisionDetail(
			makeDecision({ alternatives: ["A", "B"] }),
		);
		expect(out).toContain("- A");
		expect(out).toContain("- B");
	});

	it("formats tags as comma-separated", () => {
		const out = formatDecisionDetail(makeDecision({ tags: ["x", "y"] }));
		expect(out).toContain("x, y");
	});

	it("includes created date", () => {
		const out = formatDecisionDetail(makeDecision());
		expect(out).toContain("Created:");
		expect(out).toContain("2025-06-15");
	});

	it("wraps long text", () => {
		const longText =
			"This is a very long decision text that should definitely exceed the maximum line width and force the formatter to wrap it across multiple lines in the output";
		const out = formatDecisionDetail(makeDecision({ rawText: longText }));
		const rawTextSection = out.split("Raw text:")[1]?.split("\n") ?? [];
		expect(rawTextSection.length).toBeGreaterThan(1);
	});
});
