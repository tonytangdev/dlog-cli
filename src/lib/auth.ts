import { ApiError } from "./api.js";
import { getSyncMeta } from "./db.js";

export class AuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AuthError";
	}
}

export function isLoggedIn(): boolean {
	return getSyncMeta("session_token") !== null;
}

export function requireAuth(): string {
	const token = getSyncMeta("session_token");
	if (!token) {
		throw new AuthError("Not logged in. Run: dlog login");
	}
	return token;
}

export function getActiveTeam(): string | null {
	return getSyncMeta("active_team");
}

export function requireActiveTeam(): string {
	const team = getActiveTeam();
	if (!team) {
		throw new AuthError("No active team. Run: dlog use <slug>");
	}
	return team;
}

export function handleCommandError(error: unknown, context: string): never {
	if (error instanceof AuthError) {
		console.error(error.message);
		process.exit(1);
	}
	if (error instanceof ApiError) {
		console.error(`${context}: ${error.status} — ${error.body}`);
		process.exit(1);
	}
	if (error instanceof Error && error.name === "ExitPromptError") {
		process.exit(0);
	}
	console.error(`${context}: ${error}`);
	process.exit(1);
}
