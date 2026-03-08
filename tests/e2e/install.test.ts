import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createTempDir } from "../helpers/temp-dir.js";

const execFile = promisify(execFileCb);

const CLI_PATH = resolve("dist/index.js");
const CLI_EXISTS = existsSync(CLI_PATH);

async function runCli(
  args: string[],
  options?: { cwd?: string }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFile("node", [CLI_PATH, ...args], {
      cwd: options?.cwd,
      timeout: 15_000,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.code ?? 1,
    };
  }
}

describe("CLI install", () => {
  beforeAll(() => {
    if (!CLI_EXISTS) {
      console.warn(
        `Skipping CLI E2E tests: dist/index.js not found. Run "npm run build" first.`
      );
    }
  });

  let tmpDir: { path: string; cleanup: () => Promise<void> };

  beforeEach(async () => {
    tmpDir = await createTempDir();
  });

  afterEach(async () => {
    await tmpDir.cleanup();
  });

  describe.skipIf(!CLI_EXISTS)("canvaskit install --skills", () => {
    it("should copy skill files to .claude/skills/canvaskit/", async () => {
      const { stdout, exitCode } = await runCli(["install", "--skills"], {
        cwd: tmpDir.path,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Skills installed to");

      const destDir = join(tmpDir.path, ".claude", "skills", "canvaskit");
      expect(existsSync(join(destDir, "SKILL.md"))).toBe(true);
      expect(existsSync(join(destDir, "docs", "cli.md"))).toBe(true);
      expect(existsSync(join(destDir, "docs", "mcp.md"))).toBe(true);

      // Verify content is not empty
      const skillContent = await readFile(join(destDir, "SKILL.md"), "utf-8");
      expect(skillContent).toContain("canvaskit");
    });

    it("should show usage without --skills flag", async () => {
      const { stdout, exitCode } = await runCli(["install"], {
        cwd: tmpDir.path,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Usage: canvaskit install --skills");
    });
  });
});
