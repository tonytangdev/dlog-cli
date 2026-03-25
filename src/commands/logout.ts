import type { Command } from "commander";
import { setSyncMeta } from "../lib/db.js";

export function registerLogoutCommand(program: Command) {
	program
		.command("logout")
		.description("Log out (local data stays)")
		.action(() => {
			setSyncMeta("session_token", null);
			setSyncMeta("active_team", null);
			setSyncMeta("last_sync_at", null);
			console.log("Logged out. Local decisions are still available.");
		});
}
