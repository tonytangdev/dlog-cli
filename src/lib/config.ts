import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface Config {
	apiUrl?: string;
}

const DLOG_DIR = process.env.DLOG_CONFIG_DIR || join(homedir(), ".dlog");
const CONFIG_PATH = join(DLOG_DIR, "config.json");

export function loadConfig(): Config {
	try {
		if (!existsSync(CONFIG_PATH)) return {};
		const raw = readFileSync(CONFIG_PATH, "utf-8");
		return JSON.parse(raw) as Config;
	} catch {
		return {};
	}
}

export function saveConfig(config: Config): void {
	if (!existsSync(DLOG_DIR)) {
		mkdirSync(DLOG_DIR, { recursive: true });
	}
	const tmp = `${CONFIG_PATH}.tmp`;
	writeFileSync(tmp, JSON.stringify(config, null, 2));
	renameSync(tmp, CONFIG_PATH);
}

export function getApiUrl(): string {
	const config = loadConfig();
	return config.apiUrl || "https://log-decisions-simplified.fly.dev";
}
