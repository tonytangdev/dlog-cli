import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

function getCacheFile(): string {
	const configDir = process.env.DLOG_CONFIG_DIR ?? join(homedir(), ".dlog");
	return join(configDir, "last-results.json");
}

export async function saveLastResults(ids: string[]): Promise<void> {
	const file = getCacheFile();
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, JSON.stringify(ids), "utf8");
}

export async function resolveIndex(index: number): Promise<string | null> {
	try {
		const data = await readFile(getCacheFile(), "utf8");
		const ids = JSON.parse(data) as string[];
		return ids[index - 1] ?? null;
	} catch {
		return null;
	}
}
