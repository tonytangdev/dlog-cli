import { input, select } from "@inquirer/prompts";

export async function editAlternatives(current: string[]): Promise<string[]> {
	const alternatives = [...current];

	while (true) {
		displayAlternativesList(alternatives);
		const action = await promptForAction(alternatives);

		if (action === "done") break;

		await applyAction(alternatives, action);
	}

	return alternatives;
}

function displayAlternativesList(alternatives: string[]): void {
	console.log("\nAlternatives:");

	if (alternatives.length === 0) {
		console.log("  (none)");
		return;
	}

	for (let i = 0; i < alternatives.length; i++) {
		console.log(`  ${i + 1}. ${alternatives[i]}`);
	}
}

async function promptForAction(alternatives: string[]): Promise<string> {
	const choices = buildMenuChoices(alternatives);

	return await select({
		message: "What would you like to do?",
		choices,
	});
}

function buildMenuChoices(
	alternatives: string[],
): { name: string; value: string }[] {
	const choices: { name: string; value: string }[] = [
		{ name: "Add new alternative", value: "add" },
	];

	for (let i = 0; i < alternatives.length; i++) {
		choices.push({ name: `Edit alternative ${i + 1}`, value: `edit:${i}` });
		choices.push({
			name: `Delete alternative ${i + 1}`,
			value: `delete:${i}`,
		});
	}

	choices.push({ name: "Done with alternatives", value: "done" });

	return choices;
}

async function applyAction(
	alternatives: string[],
	action: string,
): Promise<void> {
	if (action === "add") {
		await addAlternative(alternatives);
	} else if (action.startsWith("edit:")) {
		await editExistingAlternative(alternatives, action);
	} else if (action.startsWith("delete:")) {
		deleteAlternative(alternatives, action);
	}
}

async function addAlternative(alternatives: string[]): Promise<void> {
	const newAlt = await input({
		message: "Enter new alternative:",
		validate: (value) => value?.length > 0 || "Alternative cannot be empty",
	});
	alternatives.push(newAlt);
}

async function editExistingAlternative(
	alternatives: string[],
	action: string,
): Promise<void> {
	const index = extractIndex(action);
	const edited = await input({
		message: `Edit alternative ${index + 1}:`,
		default: alternatives[index],
	});
	alternatives[index] = edited;
}

function deleteAlternative(alternatives: string[], action: string): void {
	const index = extractIndex(action);
	alternatives.splice(index, 1);
}

function extractIndex(action: string): number {
	const indexStr = action.split(":")[1];
	if (!indexStr) {
		throw new Error(`Invalid action format: ${action}`);
	}
	return Number.parseInt(indexStr, 10);
}
