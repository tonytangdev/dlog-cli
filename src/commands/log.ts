import { Command } from "commander";
import { handleCommandError } from "../lib/errors.js";
import { getDb } from "../lib/db.js";
import { decisions } from "../lib/schema.js";

function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
		process.stdin.on("end", () =>
			resolve(Buffer.concat(chunks).toString("utf8")),
		);
		process.stdin.on("error", reject);
	});
}

export function createLogCommand(): Command {
	return new Command("log")
		.description("Log a decision")
		.argument("[text]", "Decision text (or pipe via stdin)")
		.option("-p, --project <name>", "Tag with a project name")
		.option("--no-enrich", "Skip AI enrichment (kept for compat, no-op)")
		.option("--outcome <text>", "Decision outcome")
		.option("--reasoning <text>", "Decision reasoning")
		.option("--alternatives <items>", "Comma-separated alternatives")
		.option("--tags <items>", "Comma-separated tags")
		.action(
			async (
				text: string | undefined,
				options: {
					project?: string;
					enrich?: boolean;
					outcome?: string;
					reasoning?: string;
					alternatives?: string;
					tags?: string;
				},
			) => {
				let rawText = text;

				if (!rawText && !process.stdin.isTTY) {
					rawText = (await readStdin()).trim();
				}

				if (!rawText) {
					console.error(
						'Error: no decision text provided. Usage: dlog log "your decision"',
					);
					process.exit(1);
				}

				if (rawText.length > 10000) {
					console.error("Error: decision text exceeds 10,000 characters.");
					process.exit(1);
				}

				try {
					const id = crypto.randomUUID();
					const now = new Date();

					const db = getDb();
					db.insert(decisions)
						.values({
							id,
							rawText,
							project: options.project ?? null,
							outcome: options.outcome ?? null,
							reasoning: options.reasoning ?? null,
							alternatives: options.alternatives
								? JSON.stringify(
										options.alternatives.split(",").map((s) => s.trim()),
									)
								: null,
							tags: options.tags
								? JSON.stringify(options.tags.split(",").map((s) => s.trim()))
								: null,
							status: "active",
							createdAt: now,
							updatedAt: now,
						})
						.run();

					console.log(`Decision logged (id: ${id}).`);
				} catch (error) {
					handleCommandError(error, "logging decision");
				}
			},
		);
}
