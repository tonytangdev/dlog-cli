# Remove All Online Features

**Date:** 2026-03-25
**Goal:** Strip all cloud sync, authentication, and team management, making dlog-cli a purely local tool.

## Approach

Surgical removal — delete online-only files, clean up schema, update remaining commands.

## Files to Delete

- `src/commands/login.ts`
- `src/commands/logout.ts`
- `src/commands/team.ts`
- `src/commands/use.ts`
- `src/commands/sync.ts`
- `src/lib/api.ts`
- `src/lib/auth.ts`
- `src/lib/config.ts`
- `src/lib/sync.ts`
- `src/lib/sync-log.ts`

## Schema Changes (`src/lib/schema.ts`)

- Remove `syncStatus` column from `decisions` table
- Remove `sync_meta` table entirely

## DB Setup Changes (`src/lib/db.ts`)

- Remove sync-related initialization (sync_meta table creation)
- Remove `getSyncMeta()` and `setSyncMeta()` functions
- Remove config dir logic if only needed for config.json
- **Migration:** Drop `syncStatus` column and `sync_meta` table from existing DBs on startup (or recreate DB)

## Command Changes

| File | Change |
|------|--------|
| `src/commands/log.ts` | Remove `syncStatus: "pending"`, remove auto-sync call, replace `handleCommandError` |
| `src/commands/edit.ts` | Remove `syncStatus: "modified"`, replace `handleCommandError` |
| `src/commands/delete.ts` | Remove sync status updates, replace `handleCommandError` |
| `src/commands/restore.ts` | Remove sync status updates, replace `handleCommandError` |
| `src/commands/list.ts` | Replace `handleCommandError` import (from deleted `auth.ts`) |
| `src/commands/search.ts` | Replace `handleCommandError` import |
| `src/commands/view.ts` | Replace `handleCommandError` import |

### handleCommandError migration

`handleCommandError` currently lives in `lib/auth.ts`. All commands import it. Since `auth.ts` is being deleted, either:
- Inline error handling in each command, OR
- Move `handleCommandError` to a new `lib/errors.ts`

### Cleanup

- Remove all `// TODO: maybeSync()` comments from commands

## CLI Entry (`src/index.ts`)

- Remove `login`, `logout`, `team`, `use`, `sync` command registrations
- Remove any auto-sync hooks or imports

## Dependencies (`package.json`)

- Audit and remove deps only used by online features

## Tests

- Remove/update tests referencing sync, auth, or API
- Remove `getSyncMeta`/`setSyncMeta` tests from `src/lib/__tests__/db.test.ts`

## Unchanged

- `search.ts`, `list.ts`, `view.ts` — local-only (only need handleCommandError migration)
- `format.ts`, `prompts.ts`, `result-cache.ts` — no sync references
- SQLite FTS5 search — purely local
