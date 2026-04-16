import { execa } from "execa";

function formatForLog(cmd, args) {
  return [
    cmd,
    ...args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg))
  ].join(" ");
}

export function run(cmd, args = []) {
  const normalizedArgs = Array.isArray(args)
    ? args.map(String)
    : [];

  console.log("Running:", formatForLog(cmd, normalizedArgs));

  return execa(cmd, normalizedArgs, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10
  })
    .then(({ stdout }) => stdout.toString())
    .catch((error) => {
      throw (
        error?.stderr?.toString?.() ||
        error?.stdout?.toString?.() ||
        error?.shortMessage ||
        error?.message ||
        String(error)
      );
    });
}