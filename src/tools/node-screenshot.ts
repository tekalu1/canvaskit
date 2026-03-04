/**
 * MCP-specific screenshot helpers for node:* tools.
 *
 * Transport-independent logic lives in ../services/node-screenshot.ts.
 * This module re-exports those utilities and adds the MCP response builder.
 */

export {
  resolveScreenshotScope,
  captureNodeScreenshot,
  tryScreenshot,
  saveScreenshot,
} from "../services/node-screenshot.js";

export type { ScreenshotData } from "../services/node-screenshot.js";

interface TextContent {
  type: "text";
  text: string;
}

interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

/**
 * Build an MCP response with text + optional image content.
 * Replaces `ok()` when screenshot capture is enabled.
 */
export function okWithScreenshot(
  data: unknown,
  screenshot: { base64: string; mimeType: string } | null
) {
  const content: Array<TextContent | ImageContent> = [
    { type: "text" as const, text: JSON.stringify(data, null, 2) },
  ];

  if (screenshot) {
    content.push({
      type: "image" as const,
      data: screenshot.base64,
      mimeType: screenshot.mimeType,
    });
  }

  return { content };
}
