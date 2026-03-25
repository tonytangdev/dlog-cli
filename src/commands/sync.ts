import type { Command } from "commander";
import { handleCommandError, requireAuth } from "../lib/auth.js";
import { fullSync } from "../lib/sync.js";

export function registerSyncCommand(program: Command) {
	program
		.command("sync")
		.description("Sync decisions with remote API")
		.action(async () => {
			try {
				requireAuth();
				console.log("Syncing...");
				await fullSync();
				console.log("Sync complete.");
			} catch (error) {
				handleCommandError(error, "sync");
			}
		});
}
