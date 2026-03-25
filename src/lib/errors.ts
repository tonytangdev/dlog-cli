export function handleCommandError(error: unknown, context: string): never {
	if (error instanceof Error && error.name === "ExitPromptError") {
		process.exit(0);
	}
	console.error(`${context}: ${error}`);
	process.exit(1);
}
