import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ComponentRegistry } from "../core/component.js";
import type { Document } from "../core/document.js";
import type { ComponentDefinition } from "../core/schema.js";

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

export function registerComponentTools(
  server: McpServer,
  getDocument: () => Document,
  autoSave: () => Promise<void>
) {
  function getComponentRegistry() {
    return new ComponentRegistry(getDocument());
  }

  server.tool(
    "component:create",
    "Create a reusable component definition",
    {
      name: z.string().describe("Component name (used as ID)"),
      description: z.string().optional().describe("Component description"),
      variants: z
        .record(z.string(), z.record(z.string(), z.unknown()))
        .optional()
        .describe("Variant definitions"),
      props: z.array(z.string()).optional().describe("Accepted prop names"),
      defaultProps: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Default prop values"),
      template: z
        .object({
          type: z.string(),
          content: z.string().optional(),
          styles: z.record(z.string(), z.unknown()).optional(),
          children: z.array(z.any()).optional(),
        })
        .optional()
        .describe("Component template tree"),
    },
    async ({ name, description, variants, props, defaultProps, template }) => {
      try {
        const cr = getComponentRegistry();
        const definition: ComponentDefinition = {
          description,
          variants: variants ?? {},
          props: props ?? [],
          defaultProps: defaultProps ?? {},
          template,
        };
        cr.create(name, definition);
        await autoSave();
        return ok({ created: name });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "component:list",
    "List all registered components",
    {},
    async () => {
      try {
        const cr = getComponentRegistry();
        const components = cr.list();
        return ok({ components });
      } catch (e) {
        return fail(e);
      }
    }
  );
}
