import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VariableManager } from "../core/variable.js";
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

export function registerVariableTools(
  server: McpServer,
  getDocument: () => Document,
  autoSave: () => Promise<void>
) {
  function getVariableManager() {
    return new VariableManager(getDocument());
  }

  server.tool(
    "variable:set",
    "Set or update a design variable (supports themed values)",
    {
      name: z.string().describe("Variable name (e.g. 'primary', 'spacing-md')"),
      type: z.enum(["color", "spacing", "number", "string"]).describe("Variable type"),
      value: z.string().describe("Variable value"),
      theme: z.record(z.string(), z.string()).optional().describe("Theme context for this value (e.g. {mode: 'dark'})"),
    },
    async ({ name, type, value, theme }) => {
      try {
        const vm = getVariableManager();
        vm.set(name, type, value, theme);
        await autoSave();
        return ok({ set: name, type, value, theme });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "variable:get",
    "Get a variable definition",
    {
      name: z.string().describe("Variable name"),
      theme: z.record(z.string(), z.string()).optional().describe("Theme context to resolve value"),
    },
    async ({ name, theme }) => {
      try {
        const vm = getVariableManager();
        const variable = vm.get(name);
        if (!variable) {
          return fail(new Error(`Variable "${name}" not found`));
        }
        const resolved = vm.resolve(name, theme);
        return ok({ name, variable, resolved });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "variable:delete",
    "Delete a variable",
    {
      name: z.string().describe("Variable name to delete"),
    },
    async ({ name }) => {
      try {
        const vm = getVariableManager();
        const deleted = vm.delete(name);
        if (!deleted) {
          return fail(new Error(`Variable "${name}" not found`));
        }
        await autoSave();
        return ok({ deleted: name });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "variable:list",
    "List all variables",
    {},
    async () => {
      try {
        const vm = getVariableManager();
        const variables = vm.list();
        return ok({ variables, count: variables.length });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "variable:theme-axis",
    "Set or update a theme axis (e.g. mode: [light, dark])",
    {
      name: z.string().describe("Theme axis name (e.g. 'mode', 'density')"),
      values: z.array(z.string()).min(1).describe("Available values for this axis"),
    },
    async ({ name, values }) => {
      try {
        const vm = getVariableManager();
        vm.setThemeAxis(name, values);
        await autoSave();
        return ok({ axis: name, values });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "variable:export-css",
    "Export variables as CSS custom properties with theme variants",
    {
      theme: z.record(z.string(), z.string()).optional().describe("Theme context"),
    },
    async ({ theme }) => {
      try {
        const vm = getVariableManager();
        const css = vm.toCssCustomProperties(theme);
        return ok({ css });
      } catch (e) {
        return fail(e);
      }
    }
  );
}
