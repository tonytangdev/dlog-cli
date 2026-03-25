# Remove Online Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip all cloud sync, authentication, and team management from dlog-cli, making it purely local.

**Architecture:** Delete 10 online-only files, migrate `handleCommandError` to a new `lib/errors.ts`, remove `syncStatus` column and `sync_meta` table from schema, clean up all commands.

**Tech Stack:** TypeScript, SQLite (better-sqlite3), Drizzle ORM, Commander.js

**Spec:** `docs/superpowers/specs/2026-03-25-remove-online-features-design.md`

---

### Task 1: Create `lib/errors.ts` (extract from `auth.ts`)

**Files:**
- Create: `src/lib/errors.ts`
- Test: `src/lib/__tests__/db.test.ts` (no new tests needed — simple error handler)

`handleCommandError` currently lives in `auth.ts` and handles `AuthError`, `ApiError`, `ExitPromptError`, and generic errors. After removing online features, we only need `ExitPromptError` and generic error handling.

- [ ] **Step 1: Create `src/lib/errors.ts`**

```typescript
export function handleCommandError(error: unknown, context: string): never {
  if (error instanceof Error && error.name === "ExitPromptError") {
    process.exit(0);
  }
  console.error(`${context}: ${error}`);
  process.exit(1);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/lib/errors.ts`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/errors.ts
git commit -m "feat: extract handleCommandError to lib/errors.ts"
```

---

### Task 2: Update all commands to import from `errors.ts`

**Files:**
- Modify: `src/commands/log.ts:2` — change import
- Modify: `src/commands/edit.ts:4` — change import
- Modify: `src/commands/delete.ts:3` — change import
- Modify: `src/commands/restore.ts:3` — change import
- Modify: `src/commands/list.ts:4` — change import
- Modify: `src/commands/search.ts:2` — change import
- Modify: `src/commands/view.ts:3` — change import

In each file, replace:
```typescript
import { handleCommandError } from "../lib/auth.js";
```
with:
```typescript
import { handleCommandError } from "../lib/errors.js";
```

- [ ] **Step 1: Update all 7 command files**

Replace the import in each file listed above.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/commands/log.ts src/commands/edit.ts src/commands/delete.ts src/commands/restore.ts src/commands/list.ts src/commands/search.ts src/commands/view.ts
git commit -m "refactor: switch handleCommandError imports to errors.ts"
```

---

### Task 3: Remove `syncStatus` from commands

**Files:**
- Modify: `src/commands/log.ts:78` — remove `syncStatus: "pending"` from insert
- Modify: `src/commands/edit.ts:182` — remove `syncStatus: "modified"` from update
- Modify: `src/commands/delete.ts:43` — remove `syncStatus: "modified"` from update
- Modify: `src/commands/restore.ts:43` — remove `syncStatus: "modified"` from update

- [ ] **Step 1: Remove syncStatus assignments**

In each file, remove the `syncStatus: "..."` line from the `.values()` or `.set()` call. Leave the rest of the object intact.

- [ ] **Step 2: Remove all `// TODO: maybeSync()` comments**

These appear in 7 files:
- `src/commands/log.ts:84`
- `src/commands/edit.ts:168`
- `src/commands/delete.ts:49`
- `src/commands/restore.ts:49`
- `src/commands/list.ts:28`
- `src/commands/search.ts:27`
- `src/commands/view.ts:54`

Delete each TODO comment line.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: errors about `syncStatus` not in schema (expected — schema not updated yet, OR it may still compile if schema still has the column). Either way, proceed.

- [ ] **Step 4: Commit**

```bash
git add src/commands/log.ts src/commands/edit.ts src/commands/delete.ts src/commands/restore.ts src/commands/list.ts src/commands/search.ts src/commands/view.ts
git commit -m "refactor: remove syncStatus assignments and maybeSync TODOs"
```

---

### Task 4: Clean up schema

**Files:**
- Modify: `src/lib/schema.ts`

- [ ] **Step 1: Remove `syncStatus` column from `decisions` table**

In `src/lib/schema.ts`, remove lines 18-22:
```typescript
syncStatus: text("sync_status", {
    enum: ["pending", "synced", "modified"],
})
    .notNull()
    .default("pending"),
```

- [ ] **Step 2: Remove `syncMeta` table**

In `src/lib/schema.ts`, remove the entire `syncMeta` table definition (lines 26-29):
```typescript
export const syncMeta = sqliteTable("sync_meta", {
  key: text("key").primaryKey(),
  value: text("value"),
});
```

- [ ] **Step 3: Remove unused imports if any**

Check if removing `syncMeta` leaves any unused imports at the top of schema.ts.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: errors in db.ts referencing syncMeta (expected — will fix in next task)

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts
git commit -m "refactor: remove syncStatus column and syncMeta table from schema"
```

---

### Task 5: Clean up `db.ts`

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Remove `getSyncMeta` and `setSyncMeta` functions**

Delete the `getSyncMeta` function (lines 123-131) and `setSyncMeta` function (lines 133-143).

- [ ] **Step 2: Remove `sync_meta` table creation from raw SQL**

In the `initDb` or setup function, remove the `CREATE TABLE IF NOT EXISTS sync_meta` SQL statement (around lines 67-70).

- [ ] **Step 3: Remove `syncStatus` column from `CREATE TABLE decisions` raw SQL**

Remove the `sync_status` column definition from the raw SQL CREATE TABLE statement (around lines 63-64).

- [ ] **Step 4: Remove `syncMeta` import from schema**

If db.ts imports `syncMeta` from schema.ts, remove that import.

- [ ] **Step 5: Add migration SQL for existing DBs**

Add to the DB initialization (after table creation):
```typescript
// Migration: drop sync-related columns/tables from existing DBs
db.exec(`DROP TABLE IF EXISTS sync_meta`);
// SQLite doesn't support DROP COLUMN before 3.35.0; since we use
// CREATE TABLE IF NOT EXISTS, the column will just be ignored if present.
// For a clean slate, users can delete ~/.dlog/decisions.db.
```

- [ ] **Step 6: Remove exports of `getSyncMeta`/`setSyncMeta` if re-exported elsewhere**

Check the file for any re-exports.

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors (or errors only in files we're about to delete)

- [ ] **Step 8: Commit**

```bash
git add src/lib/db.ts
git commit -m "refactor: remove sync-related functions and schema from db.ts"
```

---

### Task 6: Update tests

**Files:**
- Modify: `src/lib/__tests__/db.test.ts`

- [ ] **Step 1: Remove `getSyncMeta`/`setSyncMeta` tests**

Delete the test blocks at lines 30-53 that test these two functions. Also remove the imports of `getSyncMeta`/`setSyncMeta` at the top of the file.

- [ ] **Step 2: Run tests**

Run: `bun test` (or `npm test`)
Expected: all remaining tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/db.test.ts
git commit -m "test: remove sync-related tests"
```

---

### Task 7: Remove online command registrations from `index.ts`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Remove command imports and registrations**

Remove imports and `register*Command(program)` calls for:
- `login` (import + registration)
- `logout` (import + registration)
- `team` (import + registration)
- `use` (import + registration)
- `sync` (import + registration)

Keep: `log`, `search`, `list`, `view`, `edit`, `delete`, `restore`.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors (deleted files no longer imported)

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "refactor: remove online command registrations from CLI entry"
```

---

### Task 8: Delete online-only files

**Files:**
- Delete: `src/commands/login.ts`
- Delete: `src/commands/logout.ts`
- Delete: `src/commands/team.ts`
- Delete: `src/commands/use.ts`
- Delete: `src/commands/sync.ts`
- Delete: `src/lib/api.ts`
- Delete: `src/lib/auth.ts`
- Delete: `src/lib/config.ts`
- Delete: `src/lib/sync.ts`
- Delete: `src/lib/sync-log.ts`

- [ ] **Step 1: Delete all 10 files**

```bash
rm src/commands/login.ts src/commands/logout.ts src/commands/team.ts src/commands/use.ts src/commands/sync.ts src/lib/api.ts src/lib/auth.ts src/lib/config.ts src/lib/sync.ts src/lib/sync-log.ts
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run all tests**

Run: `bun test` (or `npm test`)
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove all online-only files (auth, sync, api, config, team)"
```

---

### Task 9: Audit and clean dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Check for unused deps**

Grep the remaining `src/` files for each dependency in package.json. Remove any that are no longer imported anywhere. Likely candidates: none expected (the online features used built-in `fetch`), but verify.

- [ ] **Step 2: Rebuild and test**

Run: `bun install && bun test`
Expected: clean install, all tests pass

- [ ] **Step 3: Run the CLI end-to-end**

```bash
bun run src/index.ts --help
```
Expected: only local commands shown (log, search, list, view, edit, delete, restore)

- [ ] **Step 4: Commit if deps changed**

```bash
git add package.json bun.lockb
git commit -m "chore: remove unused dependencies"
```

---

### Task 10: Final verification

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Full test suite**

Run: `bun test`
Expected: all tests pass

- [ ] **Step 3: Lint**

Run: `npx biome check src/`
Expected: no errors (or only pre-existing ones)

- [ ] **Step 4: Grep for orphaned references**

```bash
grep -r "syncStatus\|syncMeta\|maybeSync\|ApiError\|AuthError\|requireAuth\|isLoggedIn\|getApiUrl\|createApiClient\|syncLog\|sync_meta\|session_token\|active_team" src/ --include="*.ts"
```
Expected: no matches

- [ ] **Step 5: Commit any final fixes**

If any issues found, fix and commit.
