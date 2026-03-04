import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TokenManager } from "../core/token.js";
import type { Document } from "../core/document.js";
import type { TokenCategory } from "../core/schema.js";

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

const TOKEN_CATEGORY_ENUM = z.enum([
  "colors",
  "spacing",
  "typography",
  "borderRadius",
  "shadows",
  "breakpoints",
]);

export function registerTokenTools(
  server: McpServer,
  getDocument: () => Document,
  autoSave: () => Promise<void>
) {
  function getTokenManager() {
    return new TokenManager(getDocument());
  }

  server.tool(
    "token:set",
    "Set one or more design tokens",
    {
      tokens: z
        .array(
          z.object({
            category: TOKEN_CATEGORY_ENUM.describe("Token category"),
            key: z.string().describe("Token key"),
            value: z.unknown().describe("Token value (string or object for typography)"),
            description: z.string().optional().describe("Token description"),
          })
        )
        .describe("Array of tokens to set"),
    },
    async ({ tokens }) => {
      try {
        const tm = getTokenManager();
        const mapped = tokens.map((t) => ({
          category: t.category as TokenCategory,
          key: t.key,
          value: t.value as string | object,
          description: t.description,
        }));
        const result = tm.set(mapped);
        await autoSave();
        return ok(result);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "token:get",
    "Get a specific design token",
    {
      category: TOKEN_CATEGORY_ENUM.describe("Token category"),
      key: z.string().describe("Token key"),
    },
    async ({ category, key }) => {
      try {
        const tm = getTokenManager();
        const value = tm.get(category as TokenCategory, key);
        if (value === undefined) {
          return fail(new Error(`Token "${category}.${key}" not found`));
        }
        return ok({ category, key, value });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "token:list",
    "List all design tokens, optionally filtered by category",
    {
      category: TOKEN_CATEGORY_ENUM.optional().describe("Filter by category"),
    },
    async ({ category }) => {
      try {
        const tm = getTokenManager();
        const tokens = tm.list(category as TokenCategory | undefined);
        return ok(tokens);
      } catch (e) {
        return fail(e);
      }
    }
  );
}
