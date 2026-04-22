import { run } from "../runner.js";
import fs from "fs";

/**
 * TESTER AGENT
 * - runs project tests
 * - captures output
 * - returns structured result for AI loop
 */
export async function runTests() {
  try {
    const output = await run("npm", ["test"]);

    return {
      success: true,
      output: output.toString(),
      errors: null
    };

  } catch (err) {
    return {
      success: false,
      output: err.toString(),
      errors: extractErrors(err.toString())
    };
  }
}

/**
 * Extract meaningful error lines for AI debugging
 */
function extractErrors(log) {
  if (!log) return [];

  return log
    .split("\n")
    .filter(line =>
      line.includes("Error") ||
      line.includes("FAIL") ||
      line.includes("Expected") ||
      line.includes("Received")
    )
    .slice(0, 30); // prevent huge context
}