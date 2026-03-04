import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PageManager } from "../core/page.js";
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

export function registerPageTools(
  server: McpServer,
  getDocument: () => Document,
  autoSave: () => Promise<void>
) {
  function getPageManager() {
    return new PageManager(getDocument());
  }

  server.tool(
    "page:update",
    "Update page properties (name, width, height)",
    {
      pageId: z.string().describe("Page ID to update"),
      name: z.string().optional().describe("New page name"),
      width: z.number().optional().describe("New page width"),
      height: z.number().nullable().optional().describe("New page height (null for auto)"),
    },
    async ({ pageId, name, width, height }) => {
      try {
        const pm = getPageManager();
        const updates: { name?: string; width?: number; height?: number | null } = {};
        if (name !== undefined) updates.name = name;
        if (width !== undefined) updates.width = width;
        if (height !== undefined) updates.height = height;
        const result = pm.update(pageId, updates);
        await autoSave();
        return ok({ updated: result });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "page:list",
    "List all pages in the current document",
    {},
    async () => {
      try {
        const pm = getPageManager();
        const pages = pm.list();
        return ok({ pages, count: pages.length });
      } catch (e) {
        return fail(e);
      }
    }
  );
}
