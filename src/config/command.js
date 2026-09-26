import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function runCommand(args = []) {
  try {
    const { stdout, stderr } = await execFileAsync("alpaca", args);

    if (stderr) {
      console.error(stderr);
    }

    return stdout.trim();
  } catch (error) {
    console.error("Alpaca command failed:", error);

    throw new Error(
      error.stderr?.trim() ||
      error.message ||
      "Alpaca command failed"
    );
  }
}