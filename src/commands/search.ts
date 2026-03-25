import { Command } from "commander";
import { handleCommandError } from "../lib/errors.js";
import { formatSearchResults } from "../lib/format.js";
import { saveLastResults } from "../lib/result-cache.js";
import { searchDecisions } from "../lib/search.js";

export function createSearchCommand(): Command {
	return new Command("search")
		.description("Search decisions")
		.argument("<query>", "Search text")
		.option("--limit <n>", "Max results", parseInt, 5)
		.option("--deleted", "Search deleted decisions")
		.action(
			async (query: string, options: { limit: number; deleted?: boolean }) => {
				try {
					const status = options.deleted ? "archived" : "active";
					const results = searchDecisions(query, {
						limit: options.limit,
						status,
					});

					if (results.length === 0) {
						console.log("No decisions found.");
						return;
					}

					console.log(formatSearchResults(results));
					await saveLastResults(results.map((r) => r.id));
					console.log(
						`\n${results.length} result${results.length === 1 ? "" : "s"} found.`,
					);
				} catch (error) {
					handleCommandError(error, "searching decisions");
				}
			},
		);
}
