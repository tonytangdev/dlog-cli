#!/usr/bin/env node
import { Command } from "commander";
import { createDeleteCommand } from "./commands/delete.js";
import { createEditCommand } from "./commands/edit.js";
import { createListCommand } from "./commands/list.js";
import { createLogCommand } from "./commands/log.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerLogoutCommand } from "./commands/logout.js";
import { createRestoreCommand } from "./commands/restore.js";
import { createSearchCommand } from "./commands/search.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerTeamCommand } from "./commands/team.js";
import { registerUseCommand } from "./commands/use.js";
import { createViewCommand } from "./commands/view.js";

const program = new Command();

program
	.name("dlog")
	.description("Log and search decisions — local-first")
	.version("0.4.0");

registerLoginCommand(program);
registerLogoutCommand(program);
registerTeamCommand(program);
registerUseCommand(program);
program.addCommand(createLogCommand());
program.addCommand(createSearchCommand());
program.addCommand(createListCommand());
program.addCommand(createViewCommand());
program.addCommand(createEditCommand());
program.addCommand(createDeleteCommand());
program.addCommand(createRestoreCommand());
registerSyncCommand(program);

program.parse();
