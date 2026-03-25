import { Command } from "commander";
import { inArray } from "drizzle-orm";
import { handleCommandError } from "../lib/errors.js";
import { getDb } from "../lib/db.js";
import { resolveIndex } from "../lib/result-cache.js";
import { decisions } from "../lib/schema.js";

export function createDeleteCommand(): Command {
	return new Command("delete")
		.description("Delete decisions (soft delete, restorable)")
		.argument("<refs...>", "Decision IDs or numeric indices from search/list")
		.action(async (refs: string[]) => {
			try {
				const resolvedIds: string[] = [];
				for (const raw of refs) {
					if (raw.match(/^[0-9a-f-]{36}$/i)) {
						resolvedIds.push(raw);
					} else {
						const index = parseInt(raw, 10);
						if (!Number.isNaN(index) && index > 0) {
							const cached = await resolveIndex(index);
							if (cached) {
								resolvedIds.push(cached);
							} else {
								console.error(
									`Decision #${index} not found. Run 'dlog search' or 'dlog list' first.`,
								);
								process.exit(1);
							}
						} else {
							console.error(`Invalid decision ID: ${raw}`);
							process.exit(1);
						}
					}
				}

				const db = getDb();
				const now = new Date();
				db.update(decisions)
					.set({
						status: "archived",
						deletedAt: now,
						syncStatus: "modified",
						updatedAt: now,
					})
					.where(inArray(decisions.id, resolvedIds))
					.run();

				// TODO: maybeSync()
				console.log(`Deleted ${resolvedIds.length} decision(s).`);
			} catch (error) {
				handleCommandError(error, "deleting decisions");
			}
		});
}
