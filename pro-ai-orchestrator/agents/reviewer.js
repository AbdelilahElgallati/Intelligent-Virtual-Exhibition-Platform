import { run } from "../runner.js";
import { config } from "../config.js";

/**
 * REVIEWER AGENT
 * - analyzes code quality
 * - detects bugs / logic issues
 * - suggests improvements
 */
export async function review(code) {
  const prompt = config.reviewer.prompt(code);

  const output = await run(config.reviewer.cmd, [prompt]);

  return normalizeReview(output);
}

/**
 * Normalize review output so pipeline can reliably detect issues
 */
function normalizeReview(text) {
  return text
    .toString()
    .trim();
}