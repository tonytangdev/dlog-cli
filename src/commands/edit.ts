import { input } from "@inquirer/prompts";
import { Command } from "commander";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db.js";
import { handleCommandError } from "../lib/errors.js";
import { editAlternatives } from "../lib/prompts.js";
import { resolveIndex } from "../lib/result-cache.js";
import { decisions } from "../lib/schema.js";

interface DecisionData {
	id: string;
	project: string | null;
	status: "active" | "archived";
	outcome: string | null;
	reasoning: string | null;
	rawText: string;
	alternatives: string[] | null;
	tags: string[] | null;
}

function isValidUUID(str: string): boolean {
	const uuidRegex =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	return uuidRegex.test(str);
}

async function promptField(
	message: string,
	current: string | null,
): Promise<string | null> {
	const value = await input({ message, default: current ?? "" });
	return value || null;
}

function arraysAreEqual(a: string[] | null, b: string[] | null): boolean {
	if (a === b) return true;
	if (a == null || b == null) return false;
	if (a.length !== b.length) return false;
	return a.every((val, i) => val === b[i]);
}

async function collectUserEdits(original: DecisionData): Promise<DecisionData> {
	const project = await promptField("Project:", original.project);
	const outcome = await promptField("Outcome:", original.outcome);
	const reasoning = await promptField("Reasoning:", original.reasoning);
	const rawText = await input({
		message: "Raw text:",
		default: original.rawText,
		validate: (value) => value?.length > 0 || "Raw text cannot be empty",
	});
	const tagsInput = await input({
		message: "Tags (comma-separated):",
		default: original.tags?.join(", ") ?? "",
	});
	const tags = tagsInput
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
	const alternatives = await editAlternatives(original.alternatives ?? []);

	return {
		id: original.id,
		status: original.status,
		project,
		outcome,
		reasoning,
		rawText,
		tags: tags.length > 0 ? tags : null,
		alternatives,
	};
}

function buildPatch(
	original: DecisionData,
	updated: DecisionData,
): Partial<
	Pick<
		DecisionData,
		"project" | "outcome" | "reasoning" | "rawText" | "alternatives" | "tags"
	>
> {
	const patch: Partial<
		Pick<
			DecisionData,
			"project" | "outcome" | "reasoning" | "rawText" | "alternatives" | "tags"
		>
	> = {};
	if (original.project !== updated.project) patch.project = updated.project;
	if (original.outcome !== updated.outcome) patch.outcome = updated.outcome;
	if (original.reasoning !== updated.reasoning)
		patch.reasoning = updated.reasoning;
	if (original.rawText !== updated.rawText) patch.rawText = updated.rawText;
	if (!arraysAreEqual(original.alternatives, updated.alternatives))
		patch.alternatives = updated.alternatives;
	if (!arraysAreEqual(original.tags, updated.tags)) patch.tags = updated.tags;
	return patch;
}

export function createEditCommand(): Command {
	return new Command("edit")
		.description("Edit a decision interactively")
		.argument("<id>", "Decision UUID (or numeric index from search/list)")
		.action(async (ref: string) => {
			try {
				let resolvedId = ref;

				if (!isValidUUID(ref)) {
					const index = parseInt(ref, 10);
					if (!Number.isNaN(index) && index > 0) {
						const cached = await resolveIndex(index);
						if (cached) {
							resolvedId = cached;
						} else {
							console.error(
								`Decision #${index} not found. Run 'dlog search' or 'dlog list' first.`,
							);
							process.exit(1);
						}
					} else {
						console.error(
							"Invalid decision ID format. Expected UUID or numeric index.",
						);
						process.exit(1);
					}
				}

				const db = getDb();
				const row = db
					.select()
					.from(decisions)
					.where(eq(decisions.id, resolvedId))
					.get();

				if (!row) {
					console.error(`Decision ${resolvedId} not found.`);
					process.exit(1);
				}

				if (row.status === "archived") {
					console.error("Decision is deleted. Restore it first.");
					process.exit(1);
				}

				const original: DecisionData = {
					id: row.id,
					project: row.project,
					status: row.status,
					outcome: row.outcome,
					reasoning: row.reasoning,
					rawText: row.rawText,
					alternatives: row.alternatives
						? (JSON.parse(row.alternatives) as string[])
						: null,
					tags: row.tags ? (JSON.parse(row.tags) as string[]) : null,
				};

				console.log(`\nEditing decision ${resolvedId}`);
				console.log("Press Ctrl+C to cancel at any time.\n");

				const updated = await collectUserEdits(original);
				const patch = buildPatch(original, updated);

				if (Object.keys(patch).length === 0) {
					console.log("\nNo changes made.");
					process.exit(0);
				}

				db.update(decisions)
					.set({
						project: patch.project !== undefined ? patch.project : row.project,
						outcome: patch.outcome !== undefined ? patch.outcome : row.outcome,
						reasoning:
							patch.reasoning !== undefined ? patch.reasoning : row.reasoning,
						rawText: patch.rawText !== undefined ? patch.rawText : row.rawText,
						alternatives:
							patch.alternatives !== undefined
								? JSON.stringify(patch.alternatives)
								: row.alternatives,
						tags:
							patch.tags !== undefined ? JSON.stringify(patch.tags) : row.tags,
						updatedAt: new Date(),
					})
					.where(eq(decisions.id, resolvedId))
					.run();

				console.log("\nDecision updated.");
			} catch (error) {
				handleCommandError(error, "editing decision");
			}
		});
}
