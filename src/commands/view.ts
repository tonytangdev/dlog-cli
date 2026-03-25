import { Command } from "commander";
import { eq } from "drizzle-orm";
import { handleCommandError } from "../lib/errors.js";
import { getDb } from "../lib/db.js";
import { formatDecisionDetail } from "../lib/format.js";
import { resolveIndex } from "../lib/result-cache.js";
import { decisions } from "../lib/schema.js";

export function createViewCommand(): Command {
	return new Command("view")
		.description("View a specific decision")
		.argument("<id>", "Decision UUID (or numeric index from search/list)")
		.action(async (ref: string) => {
			try {
				let decisionId = ref;

				if (!ref.match(/^[0-9a-f-]{36}$/i)) {
					const index = parseInt(ref, 10);
					if (!Number.isNaN(index) && index > 0) {
						const cached = await resolveIndex(index);
						if (cached) {
							decisionId = cached;
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
					.where(eq(decisions.id, decisionId))
					.get();

				if (!row) {
					console.error(`Decision ${decisionId} not found.`);
					process.exit(1);
				}

				if (row.status === "archived") {
					console.error("Decision is deleted. Restore it first.");
					process.exit(1);
				}

				console.log(
					formatDecisionDetail({
						id: row.id,
						project: row.project,
						status: row.status,
						rawText: row.rawText,
						outcome: row.outcome,
						reasoning: row.reasoning,
						alternatives: row.alternatives
							? (JSON.parse(row.alternatives) as string[])
							: null,
						tags: row.tags ? (JSON.parse(row.tags) as string[]) : null,
						createdAt: (row.createdAt as Date).toISOString(),
					}),
				);
			} catch (error) {
				handleCommandError(error, "viewing decision");
			}
		});
}
