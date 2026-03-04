/**
 * Transport-independent screenshot service for node operations.
 *
 * Shared by both MCP tools and CLI commands.
 */

import { writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { BrowserPool } from "../preview/browser-pool.js";
import type { Document } from "../core/document.js";
import { exportToHtml } from "../export/html.js";

export interface ScreenshotData {
  base64: string;
  mimeType: string;
}

/**
 * Determine the screenshot scope (page + optional subtree) for a given tool.
 */
export function resolveScreenshotScope(
  toolName: string,
  args: Record<string, unknown>
): { pageId: string; nodeId?: string } {
  const pageId = args.pageId as string;

  switch (toolName) {
    case "node:add": {
      const nodes = args.nodes as Array<{ parentId: string }> | undefined;
      const parentId = nodes?.[0]?.parentId;
      return { pageId, nodeId: parentId === "root" ? undefined : parentId };
    }
    case "node:update": {
      const updates = args.updates as Array<{ id: string }> | undefined;
      const id = updates?.[0]?.id;
      return { pageId, nodeId: id === "root" ? undefined : id };
    }
    case "node:delete":
      return { pageId };
    case "node:move": {
      const newParentId = args.newParentId as string | undefined;
      return {
        pageId,
        nodeId: newParentId === "root" ? undefined : newParentId,
      };
    }
    case "node:list":
      return { pageId, nodeId: args.parentId as string | undefined };
    case "node:get":
      return { pageId, nodeId: args.nodeId as string | undefined };
    default:
      return { pageId };
  }
}

/**
 * Take a screenshot of the resolved scope. Returns null on failure
 * so the caller can gracefully degrade (still return text data).
 */
export async function captureNodeScreenshot(
  pool: BrowserPool,
  doc: Document,
  scope: { pageId: string; nodeId?: string }
): Promise<ScreenshotData | null> {
  try {
    const html = exportToHtml(doc, scope.pageId, scope.nodeId);
    return await pool.screenshot(html);
  } catch {
    return null;
  }
}

/**
 * Capture screenshot if pool is available, otherwise return null.
 */
export async function tryScreenshot(
  pool: BrowserPool | null | undefined,
  doc: Document,
  toolName: string,
  args: Record<string, unknown>
): Promise<ScreenshotData | null> {
  if (!pool) return null;
  const scope = resolveScreenshotScope(toolName, args);
  return captureNodeScreenshot(pool, doc, scope);
}

/**
 * Save a screenshot to disk (CLI use).
 * Creates parent directories if they don't exist.
 */
export async function saveScreenshot(
  data: ScreenshotData,
  outputPath: string
): Promise<void> {
  const buffer = Buffer.from(data.base64, "base64");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
}
