import inquirer from "inquirer";
import chalk from "chalk";
import { readFile } from "node:fs/promises";
import { runPipeline } from "./pipeline.js";

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
AI Orchestrator

Usage:
  npm run ai
  npm run ai -- -p "your task"
  npm run ai -- --prompt-file .\\your-prompt.txt
  Get-Content .\\your-prompt.txt | npm run ai

Interactive shortcuts (at prompt):
  /editor       Open multi-line editor
  /file <path>  Load prompt from file
`);
}

async function readTaskFromStdin() {
  if (process.stdin.isTTY) {
    return "";
  }

  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return input.trim();
}

async function readTaskFromFile(filePath) {
  const content = await readFile(filePath, "utf8");
  return content.trim();
}

async function askTaskInteractively() {
  const { task } = await inquirer.prompt([
    {
      type: "input",
      name: "task",
      message: "Enter your task (or /editor, /file <path>):",
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
    if (!filePath) {
      throw new Error("Missing file path. Usage: /file <path>");
    }
    return readTaskFromFile(filePath);
  }

  return trimmed;
}

async function resolveTask() {
  const cli = parseCliArgs(process.argv);

  if (cli.help) {
    printHelp();
    process.exit(0);
  }

  if (cli.prompt && cli.promptFile) {
    throw new Error("Use either --prompt or --prompt-file, not both.");
  }

  if (cli.promptFile) {
    return readTaskFromFile(cli.promptFile);
  }

  if (cli.prompt) {
    return cli.prompt.trim();
  }

  const stdinTask = await readTaskFromStdin();
  if (stdinTask) {
    return stdinTask;
  }

  return askTaskInteractively();
}

async function main() {
  const task = await resolveTask();

  console.log(chalk.blue("\n🚀 Running autonomous pipeline...\n"));

  const result = await runPipeline(task);

  console.log(chalk.green("\n🎯 FINAL CODE:\n"));
  console.log(result.code);
}

main().catch((error) => {
  console.error(chalk.red("\n❌ Pipeline failed\n"));
  console.error(typeof error === "string" ? error : error?.message || String(error));
  process.exitCode = 1;
});