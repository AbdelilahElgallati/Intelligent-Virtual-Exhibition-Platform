import { plan } from "./agents/gemini.js";
import { build } from "./agents/copilot.js";
import { review } from "./agents/gemini.js";
import { runTests } from "./testRunner.js";

function needsFix(reviewText, testResult) {
  return (
    reviewText.toLowerCase().includes("issue") ||
    reviewText.toLowerCase().includes("bug") ||
    reviewText.toLowerCase().includes("error") ||
    testResult.success === false || testResult.errors?.length > 0
  );
}

export async function runPipeline(task, maxRounds = 3) {

  console.log("🧠 PLAN");
  const planResult = await plan(task);

  let code = await build(planResult);

  for (let i = 0; i < maxRounds; i++) {

    console.log(`\n🧪 TEST ROUND ${i + 1}`);
    const testResult = await runTests();

    console.log("\n🔍 REVIEW");
    const reviewResult = await review(code);

    if (!needsFix(reviewResult, testResult)) {
      console.log("\n✅ FINAL OUTPUT READY");
      return { planResult, code, reviewResult };
    }

    console.log("\n🔧 FIXING...");

    const fixInput = `
Fix this code:

CODE:
${code}

TEST RESULT:
${testResult.output}

REVIEW:
${reviewResult}
    `;

    code = await build(fixInput);
  }

  console.log("\n⚠️ Max iterations reached");
  return { planResult, code };
}