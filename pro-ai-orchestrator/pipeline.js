import { plan } from "./agents/gemini.js";
import { build } from "./agents/copilot.js";
import { review } from "./agents/gemini.js";
import { runTests } from "./testRunner.js";
import inquirer from "inquirer";
import chalk from "chalk";
import boxen from "boxen";

async function approveStep(stepName, content) {
  console.log(boxen(content, { title: stepName, padding: 1, borderColor: 'cyan', margin: 1 }));
  const { approved } = await inquirer.prompt([
    {
      type: "confirm",
      name: "approved",
      message: `Do you approve this ${stepName}?`,
      default: true
    }
  ]);
  return approved;
}

function needsFix(reviewText, testResult) {
  return (
    reviewText.toLowerCase().includes("issue") ||
    reviewText.toLowerCase().includes("bug") ||
    reviewText.toLowerCase().includes("error") ||
    testResult.success === false
  );
}

export async function runPipeline(task, maxRounds = 3) {
  // Step 1: Planning
  const planResult = await plan(task);
  const planApproved = await approveStep("Proposed Plan", planResult);
  if (!planApproved) {
    console.log(chalk.yellow("Pipeline stopped by user."));
    return { status: 'stopped' };
  }

  // Step 2: Building
  let code = await build(planResult);
  const codeApproved = await approveStep("Generated Code", code);
  if (!codeApproved) {
      console.log(chalk.yellow("Pipeline stopped by user."));
      return { status: 'stopped' };
  }

  for (let i = 0; i < maxRounds; i++) {
    console.log(chalk.bold.blue(`\n🔄 ITERATION ROUND ${i + 1}\n`));

    // Step 3: Testing
    const testResult = await runTests();
    if (!testResult.success) {
        console.log(chalk.red("❌ Tests failed."));
    } else {
        console.log(chalk.green("✅ Tests passed."));
    }

    // Step 4: Reviewing
    const reviewResult = await review(code);
    
    if (!needsFix(reviewResult, testResult)) {
      console.log(chalk.green.bold("\n✨ All checks passed! Final output is ready.\n"));
      return { planResult, code, reviewResult, status: 'success' };
    }

    console.log(chalk.yellow("\n⚠️ Issues found in review or tests."));
    const fixApproved = await approveStep("Review & Test Failures", `REVIEW:\n${reviewResult}\n\nTEST OUTPUT:\n${testResult.output}`);
    
    if (!fixApproved) {
        console.log(chalk.yellow("Pipeline stopped by user."));
        return { status: 'stopped', code };
    }

    console.log(chalk.blue("🔧 Fixing code..."));
    const fixInput = `
Fix this code based on review and test results:

CODE:
${code}

TEST RESULT:
${testResult.output}

REVIEW:
${reviewResult}
    `;

    code = await build(fixInput);
  }

  console.log(chalk.red("\n⚠️ Max iterations reached without resolving all issues."));
  return { planResult, code, status: 'max_rounds' };
}
