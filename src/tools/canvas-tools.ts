import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CanvasManager } from "../core/canvas.js";
import type { Document } from "../core/document.js";

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function registerCanvasTools(
  server: McpServer,
  canvasManager: CanvasManager,
  getDocument: () => Document
) {
  server.tool(
    "canvas:create",
    "Create a new canvas file",
    {
      path: z.string().describe("File path for the new canvas (.canvas.json)"),
      name: z.string().optional().describe("Canvas name"),
      width: z.number().optional().describe("Canvas width in pixels"),
    },
    async ({ path, name, width }) => {
      try {
        const doc = await canvasManager.create(path, name, width);
        const pages = doc.listPages();
        return ok({
          path,
          pageId: pages[0]?.id ?? "page1",
          name: doc.meta.name,
        });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "canvas:open",
    "Open an existing canvas file",
    {
      path: z.string().describe("Path to the .canvas.json file"),
    },
    async ({ path }) => {
      try {
        const doc = await canvasManager.open(path);
        const pages = doc.listPages();
        const tokenCount = Object.values(doc.data.tokens).reduce(
          (sum, cat) => sum + Object.keys(cat).length,
          0
        );
        const nodeCount = pages.reduce((sum, p) => sum + p.nodeCount, 0);

        return ok({
          meta: doc.meta,
          pages: pages.map((p) => p.id),
          tokenCount,
          nodeCount,
        });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "canvas:save",
    "Save the current document to disk",
    {
      path: z.string().optional().describe("Alternative save path"),
      format: z.boolean().optional().describe("Pretty-print JSON (default true)"),
    },
    async ({ path, format }) => {
      try {
        const result = await canvasManager.save(path, format ?? true);
        return ok({
          path: result.path,
          size: result.size,
          modified: getDocument().meta.modified,
        });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "canvas:list_pages",
    "List all pages in the current document",
    {},
    async () => {
      try {
        const doc = getDocument();
        return ok({ pages: doc.listPages() });
      } catch (e) {
        return fail(e);
      }
    }
  );
}
