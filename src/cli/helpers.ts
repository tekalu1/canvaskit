import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { CanvasManager } from "../core/canvas.js";
import type { Document } from "../core/document.js";
import type { ScreenshotData } from "../services/node-screenshot.js";

/**
 * Open a document, run a mutation callback, then save.
 * Used by commands that modify the file (add, update, delete, move, set).
 */
export async function withDocument<T>(
  file: string,
  fn: (doc: Document) => T
): Promise<T> {
  const filePath = resolve(process.cwd(), file);
  const manager = new CanvasManager();
  const doc = await manager.open(filePath);
  const result = fn(doc);
  await manager.save();
  return result;
}

/**
 * Open a document for read-only access.
 * Used by commands that only query data (list, get).
 */
export async function readDocument(file: string): Promise<Document> {
  const filePath = resolve(process.cwd(), file);
  const manager = new CanvasManager();
  return manager.open(filePath);
}

/**
 * Read JSON from stdin. Used for --stdin batch mode.
 */
export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);
  });
}

/**
 * Print data as formatted JSON to stdout.
 */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Capture a screenshot and display or save it.
 *
 * - `screenshotOpt === true`  → inline display (falls back to temp file)
 * - `screenshotOpt === "path"` → save to that path
 * - `screenshotOpt` falsy     → skip entirely
 *
 * Uses dynamic imports so Puppeteer is not required at load time.
 * All output goes to stderr to avoid polluting JSON stdout.
 */
export async function withScreenshot(
  screenshotOpt: string | boolean | undefined,
  doc: Document,
  toolName: string,
  args: Record<string, unknown>
): Promise<void> {
  if (!screenshotOpt) return;
  const { BrowserPool } = await import("../preview/browser-pool.js");
  const { tryScreenshot, saveScreenshot } = await import("../services/node-screenshot.js");
  const pool = new BrowserPool();
  try {
    const screenshot: ScreenshotData | null = await tryScreenshot(pool, doc, toolName, args);
    if (!screenshot) return;

    if (screenshotOpt === true) {
      // Inline mode: try terminal display, fall back to temp file
      const { displayInline } = await import("../services/terminal-image.js");
      if (!displayInline(screenshot.base64)) {
        const tempPath = join(tmpdir(), `canvaskit-${Date.now()}.png`);
        await saveScreenshot(screenshot, tempPath);
        console.error(`[+] Screenshot saved to ${tempPath}`);
      }
    } else {
      // File mode: save to specified path
      await saveScreenshot(screenshot, screenshotOpt);
      console.error(`[+] Screenshot saved to ${screenshotOpt}`);
    }
  } catch (err) {
    console.error(`[!] Screenshot failed: ${(err as Error).message}`);
  } finally {
    await pool.dispose();
  }
}
