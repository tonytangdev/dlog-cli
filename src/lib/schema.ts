import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const decisions = sqliteTable("decisions", {
	id: text("id").primaryKey(),
	rawText: text("raw_text").notNull(),
	project: text("project"),
	outcome: text("outcome"),
	reasoning: text("reasoning"),
	alternatives: text("alternatives"), // JSON array
	tags: text("tags"), // JSON array
	status: text("status", { enum: ["active", "archived"] })
		.notNull()
		.default("active"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	deletedAt: integer("deleted_at", { mode: "timestamp" }),
	remoteId: text("remote_id"),
	lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
});
