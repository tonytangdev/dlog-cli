import { eq, or } from "drizzle-orm";
import { createApiClient } from "./api.js";
import { isLoggedIn, requireActiveTeam, requireAuth } from "./auth.js";
import { getApiUrl } from "./config.js";
import { getDb, getSyncMeta, setSyncMeta } from "./db.js";
import { decisions } from "./schema.js";
import { syncLog } from "./sync-log.js";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export async function maybeSync(): Promise<void> {
	if (!isLoggedIn()) return;

	const lastSyncAt = getSyncMeta("last_sync_at");
	if (lastSyncAt) {
		const elapsed = Date.now() - Number(lastSyncAt);
		if (elapsed < SYNC_COOLDOWN_MS) return;
	}

	fullSync().catch((err) => {
		syncLog(
			`maybeSync error: ${err instanceof Error ? err.message : String(err)}`,
		);
	});
}

export async function fullSync(): Promise<void> {
	const token = requireAuth();
	const teamSlug = requireActiveTeam();
	const client = createApiClient(getApiUrl(), token);

	await pushLocalChanges(client, teamSlug);
	await pullRemoteChanges(client, teamSlug);

	setSyncMeta("last_sync_at", String(Date.now()));
}

interface RemoteDecision {
	id: string;
	rawText: string;
	project?: string;
	outcome?: string;
	reasoning?: string;
	alternatives?: string[];
	tags?: string[];
	status: string;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string;
}

async function pushLocalChanges(
	client: ReturnType<typeof createApiClient>,
	teamSlug: string,
): Promise<void> {
	const db = getDb();
	const pending = await db
		.select()
		.from(decisions)
		.where(
			or(
				eq(decisions.syncStatus, "pending"),
				eq(decisions.syncStatus, "modified"),
			),
		);

	for (const decision of pending) {
		try {
			const body = {
				rawText: decision.rawText,
				project: decision.project,
				outcome: decision.outcome,
				reasoning: decision.reasoning,
				alternatives: decision.alternatives
					? JSON.parse(decision.alternatives)
					: [],
				tags: decision.tags ? JSON.parse(decision.tags) : [],
				status: decision.status,
			};

			if (!decision.remoteId) {
				// POST new
				const res = await client.post(`/api/teams/${teamSlug}/decisions`, body);
				const remote = (await res.json()) as RemoteDecision;
				await db
					.update(decisions)
					.set({
						remoteId: remote.id,
						syncStatus: "synced",
						lastSyncedAt: new Date(),
					})
					.where(eq(decisions.id, decision.id))
					.run();
			} else {
				// PATCH existing
				await client.patch(
					`/api/teams/${teamSlug}/decisions/${decision.remoteId}`,
					body,
				);
				await db
					.update(decisions)
					.set({ syncStatus: "synced", lastSyncedAt: new Date() })
					.where(eq(decisions.id, decision.id))
					.run();
			}
		} catch (err) {
			syncLog(
				`push error for ${decision.id}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}

async function pullRemoteChanges(
	client: ReturnType<typeof createApiClient>,
	teamSlug: string,
): Promise<void> {
	const db = getDb();
	const lastSyncAt = getSyncMeta("last_sync_at");
	const sinceParam = lastSyncAt
		? `?since=${new Date(Number(lastSyncAt)).toISOString()}`
		: "";

	let remoteDecisions: RemoteDecision[];
	try {
		const res = await client.get(
			`/api/teams/${teamSlug}/decisions${sinceParam}`,
		);
		remoteDecisions = (await res.json()) as RemoteDecision[];
	} catch (err) {
		syncLog(
			`pull fetch error: ${err instanceof Error ? err.message : String(err)}`,
		);
		return;
	}

	for (const remote of remoteDecisions) {
		try {
			const existing = await db
				.select()
				.from(decisions)
				.where(eq(decisions.remoteId, remote.id))
				.get();

			if (!existing) {
				// Insert new from remote
				await db
					.insert(decisions)
					.values({
						id: crypto.randomUUID(),
						rawText: remote.rawText,
						project: remote.project ?? null,
						outcome: remote.outcome ?? null,
						reasoning: remote.reasoning ?? null,
						alternatives: remote.alternatives
							? JSON.stringify(remote.alternatives)
							: null,
						tags: remote.tags ? JSON.stringify(remote.tags) : null,
						status: (remote.status as "active" | "archived") ?? "active",
						createdAt: new Date(remote.createdAt),
						updatedAt: new Date(remote.updatedAt),
						deletedAt: remote.deletedAt ? new Date(remote.deletedAt) : null,
						remoteId: remote.id,
						syncStatus: "synced",
						lastSyncedAt: new Date(),
					})
					.run();
			} else if (existing.syncStatus === "synced") {
				// Update local with remote data
				await db
					.update(decisions)
					.set({
						rawText: remote.rawText,
						project: remote.project ?? null,
						outcome: remote.outcome ?? null,
						reasoning: remote.reasoning ?? null,
						alternatives: remote.alternatives
							? JSON.stringify(remote.alternatives)
							: null,
						tags: remote.tags ? JSON.stringify(remote.tags) : null,
						status: (remote.status as "active" | "archived") ?? "active",
						updatedAt: new Date(remote.updatedAt),
						deletedAt: remote.deletedAt ? new Date(remote.deletedAt) : null,
						lastSyncedAt: new Date(),
					})
					.where(eq(decisions.id, existing.id))
					.run();
			}
			// skip if syncStatus is "modified" or "pending" (local wins)
		} catch (err) {
			syncLog(
				`pull error for remote ${remote.id}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}
