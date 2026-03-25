import { input, password, select } from "@inquirer/prompts";
import type { Command } from "commander";
import {
	createApiClient,
	getUserTeams,
	setActiveTeam,
	signIn,
} from "../lib/api.js";
import { getApiUrl } from "../lib/config.js";
import { setSyncMeta } from "../lib/db.js";
import { fullSync } from "../lib/sync.js";

export function registerLoginCommand(program: Command) {
	program
		.command("login")
		.description("Log in with email and password")
		.action(async () => {
			try {
				const baseUrl = getApiUrl();

				const email = await input({
					message: "Email:",
					validate: (v) => v?.includes("@") || "Enter a valid email",
				});

				const pw = await password({ message: "Password:", mask: "*" });

				console.log("Logging in...");
				const token = await signIn(baseUrl, { email, password: pw });
				setSyncMeta("session_token", token);

				const client = createApiClient(baseUrl, token);
				const teams = await getUserTeams(client);

				if (teams.length === 0) {
					console.log("Logged in. No teams found.");
				} else if (teams.length === 1 && teams[0]) {
					await setActiveTeam(client, teams[0].slug);
					setSyncMeta("active_team", teams[0].slug);
					console.log(`Active team: ${teams[0].name}`);
				} else {
					const slug = await select({
						message: "Select team:",
						choices: teams.map((t) => ({
							name: `${t.name} (${t.slug})`,
							value: t.slug,
						})),
					});
					await setActiveTeam(client, slug);
					setSyncMeta("active_team", slug);
					console.log(`Active team: ${slug}`);
				}

				console.log("Syncing...");
				await fullSync();
				console.log("Sync complete.");
			} catch (error) {
				if (
					error instanceof Error &&
					(error.name === "ExitPromptError" ||
						error.message.includes("cancelled"))
				) {
					console.log("Login cancelled.");
					process.exit(0);
				}
				console.error("Error:", error instanceof Error ? error.message : error);
				process.exit(1);
			}
		});
}
