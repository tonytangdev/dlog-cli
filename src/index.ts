#!/usr/bin/env node
import { Command } from "commander";
import { createDeleteCommand } from "./commands/delete.js";
import { createEditCommand } from "./commands/edit.js";
import { createListCommand } from "./commands/list.js";
import { createLogCommand } from "./commands/log.js";
import { createRestoreCommand } from "./commands/restore.js";
import { createSearchCommand } from "./commands/search.js";
import { createViewCommand } from "./commands/view.js";

const program = new Command();

program
	.name("dlog")
	.description("Log and search decisions — local-first")
	.version("0.4.0");

program.addCommand(createLogCommand());
program.addCommand(createSearchCommand());
program.addCommand(createListCommand());
program.addCommand(createViewCommand());
program.addCommand(createEditCommand());
program.addCommand(createDeleteCommand());
program.addCommand(createRestoreCommand());

program.parse();
