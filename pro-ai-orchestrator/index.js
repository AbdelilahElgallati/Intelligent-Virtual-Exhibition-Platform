#!/usr/bin/env node
import inquirer from "inquirer";
import chalk from "chalk";
import boxen from "boxen";
import { readFile } from "node:fs/promises";
import { runPipeline } from "./pipeline.js";

function printHeader() {
  console.log(
    boxen(chalk.bold.cyan("🚀 PRO AI ORCHESTRATOR"), {
      padding: 1,
      margin: 1,
      borderStyle: "double",
      borderColor: "cyan",
    })
  );
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const result = {
    prompt: null,
    promptFile: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      result.help = true;
      continue;
    }

    if (arg === "-p" || arg === "--prompt") {
      result.prompt = args[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg === "--prompt-file") {
      result.promptFile = args[i + 1] ?? "";
      i += 1;
    }
  }

  return result;
}

function printHelp() {
  console.log(`
${chalk.bold("Usage:")}
  node index.js -p "your task"
  node index.js --prompt-file ./task.txt

${chalk.bold("Interactive Commands:")}
  /editor       Open multi-line editor
  /file <path>  Load prompt from file
`);
}

async function askTaskInteractively() {
  const { task } = await inquirer.prompt([
    {
      type: "input",
      name: "task",
      message: chalk.cyan("What would you like to build today?"),
      validate: (value) => (value?.trim() ? true : "Task cannot be empty")
    }
  ]);

  const trimmed = task.trim();

  if (trimmed === "/editor") {
    const { editorTask } = await inquirer.prompt([
      {
        type: "editor",
        name: "editorTask",
        message: "Write your full task in the editor and save/close:",
        validate: (value) => (value?.trim() ? true : "Task cannot be empty")
      }
    ]);

    return editorTask.trim();
  }

  if (trimmed.startsWith("/file ")) {
    const filePath = trimmed.slice("/file ".length).trim();
    const content = await readFile(filePath, "utf8");
    return content.trim();
  }

  return trimmed;
}

async function resolveTask() {
  const cli = parseCliArgs(process.argv);

  if (cli.help) {
    printHelp();
    process.exit(0);
  }

  if (cli.promptFile) {
    const content = await readFile(cli.promptFile, "utf8");
    return content.trim();
  }

  if (cli.prompt) {
    return cli.prompt.trim();
  }

  return askTaskInteractively();
}

async function main() {
  printHeader();
  const task = await resolveTask();

  console.log(chalk.blue(`\n⚡ Initializing pipeline for: ${chalk.italic(task.substring(0, 50))}${task.length > 50 ? '...' : ''}\n`));

  const result = await runPipeline(task);

  if (result.status === 'success' || result.status === 'max_rounds') {
    console.log(boxen(chalk.green.bold("🎯 FINAL OUTPUT"), { padding: 1, borderColor: 'green', margin: 1 }));
    console.log(result.code);
  }
}

main().catch((error) => {
  console.error(chalk.red("\n❌ Pipeline failed\n"));
  console.error(error);
  process.exit(1);
});
