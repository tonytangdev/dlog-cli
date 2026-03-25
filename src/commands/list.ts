import { select } from "@inquirer/prompts";
import { Command } from "commander";
import { desc, eq, like } from "drizzle-orm";
import { handleCommandError } from "../lib/errors.js";
import { getDb } from "../lib/db.js";
import { formatSearchResults } from "../lib/format.js";
import { saveLastResults } from "../lib/result-cache.js";
import { decisions } from "../lib/schema.js";

export function createListCommand(): Command {
	return new Command("list")
		.description("List recent decisions")
		.option("--project <name>", "Filter by project name")
		.option("--limit <n>", "Results per page", "10")
		.option("--deleted", "Show deleted decisions")
		.action(
			async (options: {
				project?: string;
				limit: string;
				deleted?: boolean;
			}) => {
				try {
					const db = getDb();
					const limit = parseInt(options.limit, 10) || 10;
					const status = options.deleted ? "archived" : "active";
					let offset = 0;

					while (true) {
						const rows = await db
							.select()
							.from(decisions)
							.where(
								options.project
									? eq(decisions.status, status) &&
											like(decisions.project, `%${options.project}%`)
									: eq(decisions.status, status),
							)
							.orderBy(desc(decisions.createdAt))
							.limit(limit)
							.offset(offset);

						if (rows.length === 0 && offset === 0) {
							console.log("No decisions found.");
							return;
						}

						const mapped = rows.map((r) => ({
							id: r.id,
							rawText: r.rawText,
							project: r.project,
							outcome: r.outcome,
							reasoning: r.reasoning,
							createdAt: (r.createdAt as Date).toISOString(),
						}));

						console.log(formatSearchResults(mapped, offset));
						await saveLastResults(mapped.map((r) => r.id));

						const totalRows = await db
							.select()
							.from(decisions)
							.where(
								options.project
									? eq(decisions.status, status) &&
											like(decisions.project, `%${options.project}%`)
									: eq(decisions.status, status),
							);
						const totalCount = totalRows.length;
						const totalPages = Math.ceil(totalCount / limit);
						const currentPage = offset / limit + 1;

						console.log(
							`\nPage ${currentPage} of ${totalPages} (${totalCount} total)`,
						);

						if (totalPages <= 1) return;

						type NavChoice = "next" | "prev" | "quit";
						const choices: { name: string; value: NavChoice }[] = [];
						if (currentPage < totalPages) {
							choices.push({ name: "Next page", value: "next" });
						}
						if (currentPage > 1) {
							choices.push({ name: "Previous page", value: "prev" });
						}
						choices.push({ name: "Quit", value: "quit" });

						const action = await select<NavChoice>({
							message: "",
							choices,
						});

						if (action === "quit") return;
						if (action === "next") offset += limit;
						if (action === "prev") offset -= limit;
					}
				} catch (error) {
					handleCommandError(error, "listing decisions");
				}
			},
		);
}
