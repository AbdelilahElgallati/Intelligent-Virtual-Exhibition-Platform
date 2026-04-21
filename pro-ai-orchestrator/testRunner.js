import { run } from "./runner.js";

export async function runTests() {
  try {
    const output = await run("npm", ["test"], { label: '🧪 Running Tests' });
    return { success: true, output };
  } catch (err) {
    return { success: false, output: err };
  }
}
