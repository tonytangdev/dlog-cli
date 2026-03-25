import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DLOG_DIR = process.env.DLOG_CONFIG_DIR || join(homedir(), ".dlog");
const LOG_PATH = join(DLOG_DIR, "sync.log");

export function syncLog(message: string) {
	if (!existsSync(DLOG_DIR)) {
		mkdirSync(DLOG_DIR, { recursive: true });
	}
	appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}\n`);
}
