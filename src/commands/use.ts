import { select } from "@inquirer/prompts";
import type { Command } from "commander";
import { createApiClient, getUserTeams, setActiveTeam } from "../lib/api.js";
import { getActiveTeam, handleCommandError, requireAuth } from "../lib/auth.js";
import { getApiUrl } from "../lib/config.js";
import { setSyncMeta } from "../lib/db.js";

export function registerUseCommand(program: Command) {
	program
		.command("use [teamSlug]")
		.description("Switch active team")
		.action(async (teamSlug?: string) => {
			try {
				const token = requireAuth();
				const client = createApiClient(getApiUrl(), token);

				if (teamSlug) {
					await setActiveTeam(client, teamSlug);
					setSyncMeta("active_team", teamSlug);
					console.log(`Switched to ${teamSlug}`);
					return;
				}

				const teams = await getUserTeams(client);
				const activeTeam = getActiveTeam();

				const slug = await select({
					message: "Select team:",
					choices: teams.map((t: { name: string; slug: string }) => ({
						name: `${t.slug === activeTeam ? "> " : "  "}${t.name} (${t.slug})`,
						value: t.slug,
					})),
				});

				await setActiveTeam(client, slug);
				setSyncMeta("active_team", slug);
				console.log(`Switched to ${slug}`);
			} catch (error) {
				handleCommandError(error, "use");
			}
		});
}
