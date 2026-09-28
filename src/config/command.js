import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = Number(process.env.ALPACA_COMMAND_TIMEOUT_MS) || 30000;

export async function runCommand(args = [], options = {}) {
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;

  try {
    const { stdout, stderr } = await execFileAsync("alpaca", args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr) {
      console.error(stderr);
    }

    return stdout.trim();
  } catch (error) {
    console.error("Alpaca command failed:", error);

    if (error.killed || error.code === "ETIMEDOUT") {
      throw new Error(`Alpaca command timed out after ${timeoutMs}ms: alpaca ${args.join(" ")}`);
    }

    throw new Error(
      error.stderr?.trim() ||
        error.message ||
        "Alpaca command failed"
    );
  }
}
