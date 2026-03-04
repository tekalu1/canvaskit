/**
 * Helper to invoke MCP tool handlers directly for testing.
 * Avoids the need to set up a full MCP transport.
 */

export interface ContentBlock {
  type: string;
  text?: string;        // TextContent
  data?: string;        // ImageContent (base64)
  mimeType?: string;    // ImageContent
}

export interface ToolResult {
  content: ContentBlock[];
  isError?: boolean;
}

/**
 * Parse the JSON text from a tool result.
 * Finds the first text block (skipping any image blocks).
 */
export function parseToolResult(result: ToolResult): unknown {
  const textBlock = result.content.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("No text content in tool result");
  return JSON.parse(textBlock.text);
}

/**
 * Assert that a tool result is successful (not an error).
 */
export function expectSuccess(result: ToolResult): unknown {
  if (result.isError) {
    const data = parseToolResult(result);
    throw new Error(`Expected success but got error: ${JSON.stringify(data)}`);
  }
  return parseToolResult(result);
}

/**
 * Assert that a tool result is an error.
 */
export function expectError(result: ToolResult): { error: string } {
  if (!result.isError) {
    throw new Error(
      `Expected error but got success: ${JSON.stringify(parseToolResult(result))}`
    );
  }
  return parseToolResult(result) as { error: string };
}

/**
 * Get the image content block from a tool result, if present.
 */
export function getImageContent(result: ToolResult): ContentBlock | undefined {
  return result.content.find((b) => b.type === "image");
}
