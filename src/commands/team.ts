import type { Command } from "commander";
import { createApiClient, getUserTeams } from "../lib/api.js";
import { getActiveTeam, handleCommandError, requireAuth } from "../lib/auth.js";
import { getApiUrl } from "../lib/config.js";

export function registerTeamCommand(program: Command) {
	const team = program.command("team").description("Team management");

	team
		.command("list")
		.description("List your teams")
		.action(async () => {
			try {
				const token = requireAuth();
				const client = createApiClient(getApiUrl(), token);
				const teams = await getUserTeams(client);
				const activeTeam = getActiveTeam();

				if (teams.length === 0) {
					console.log("No teams. Create one on the web.");
					return;
				}

				for (const t of teams) {
					const marker = t.slug === activeTeam ? " > " : "   ";
					console.log(`${marker}${t.name} (${t.slug}) — ${t.role}`);
				}
			} catch (error) {
				handleCommandError(error, "team list");
			}
		});
}
