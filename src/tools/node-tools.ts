import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NodeManager } from "../core/node.js";
import { validateStyles, autoFixStyles, type StyleWarning, type StyleFix } from "../core/style-validator.js";
import type { Document } from "../core/document.js";
import type { BrowserPool } from "../preview/browser-pool.js";
import { tryScreenshot } from "../services/node-screenshot.js";
import { okWithScreenshot } from "./node-screenshot.js";

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

export function registerNodeTools(
  server: McpServer,
  getDocument: () => Document,
  autoSave: () => Promise<void>,
  browserPool?: BrowserPool | null
) {
  function getNodeManager() {
    return new NodeManager(getDocument());
  }

  server.tool(
    "node:add",
    "Add one or more nodes to a page",
    {
      pageId: z.string().describe("Target page ID"),
      nodes: z
        .array(
          z.object({
            id: z.string().optional().describe("Custom node ID (auto-generated if omitted)"),
            type: z.enum(["frame", "text", "image", "icon", "component", "vector"]).describe("Node type"),
            name: z.string().describe("Node name"),
            parentId: z.string().optional().describe("Parent frame node ID"),
            parentName: z.string().optional().describe("Parent frame name (alternative to parentId)"),
            insertIndex: z.number().optional().describe("Position among siblings"),
            content: z.string().optional().describe("Text content (for text nodes)"),
            componentRef: z.string().optional().describe("Component reference ID"),
            props: z.record(z.string(), z.unknown()).optional().describe("Component props"),
            layout: z
              .object({
                direction: z.enum(["row", "column", "none"]).default("column"),
                gap: z.string().optional(),
                align: z.string().optional(),
                justify: z.string().optional(),
                wrap: z.boolean().optional(),
              })
              .optional()
              .describe("Layout properties (for frame nodes)"),
            clip: z.boolean().optional().describe("Clip overflow content (for frame nodes)"),
            stroke: z.object({
              color: z.string(),
              width: z.union([z.string(), z.number()]),
              style: z.enum(["solid", "dashed", "dotted"]).default("solid"),
            }).optional().describe("Structured stroke (border)"),
            effects: z.array(z.discriminatedUnion("type", [
              z.object({ type: z.literal("shadow"), offsetX: z.string().default("0"), offsetY: z.string().default("4px"), blur: z.string().default("6px"), spread: z.string().default("0"), color: z.string().default("rgba(0,0,0,0.1)"), inset: z.boolean().default(false) }),
              z.object({ type: z.literal("blur"), radius: z.string() }),
              z.object({ type: z.literal("backdrop-blur"), radius: z.string() }),
            ])).optional().describe("Visual effects (shadow, blur, backdrop-blur)"),
            gradient: z.object({
              type: z.enum(["linear", "radial", "conic"]),
              angle: z.number().optional(),
              colors: z.array(z.object({ color: z.string(), position: z.number().min(0).max(1) })).min(2),
            }).optional().describe("Gradient fill"),
            styles: z.record(z.string(), z.unknown()).optional().describe("Style properties"),
            icon: z.string().optional().describe("Icon reference (for icon nodes)"),
            src: z.string().optional().describe("Image source URL"),
            alt: z.string().optional().describe("Image alt text"),
          })
        )
        .describe("Array of node definitions to add"),
      autoFix: z.boolean().optional().describe("Automatically fix known style typos"),
    },
    async ({ pageId, nodes, autoFix }) => {
      try {
        const fixes: StyleFix[] = [];
        if (autoFix) {
          for (const n of nodes) {
            if (n.styles) {
              const result = autoFixStyles(n.styles as Record<string, unknown>);
              (n as { styles: Record<string, unknown> }).styles = result.fixed;
              fixes.push(...result.fixes);
            }
          }
        }
        const nm = getNodeManager();
        const created = nm.add(pageId, nodes);
        await autoSave();
        const warnings: StyleWarning[] = [];
        for (const n of nodes) {
          if (n.styles) {
            warnings.push(...validateStyles(n.styles as Record<string, unknown>));
          }
        }
        const screenshot = await tryScreenshot(browserPool, getDocument(), "node:add", { pageId, nodes });
        return okWithScreenshot({
          created,
          ...(fixes.length > 0 ? { fixes } : {}),
          ...(warnings.length > 0 ? { warnings } : {}),
        }, screenshot);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "node:add_tree",
    "Add a nested tree of nodes to a page (children are recursively created)",
    {
      pageId: z.string().describe("Target page ID"),
      parentId: z.string().describe("Parent frame node ID for the root of the tree"),
      tree: z.union([
        z.object({
          type: z.enum(["frame", "text", "image", "icon", "component", "vector"]),
          name: z.string(),
          children: z.array(z.any()).optional(),
          content: z.string().optional(),
          icon: z.string().optional(),
          src: z.string().optional(),
          alt: z.string().optional(),
          componentRef: z.string().optional(),
          props: z.record(z.string(), z.unknown()).optional(),
          layout: z.object({
            direction: z.enum(["row", "column", "none"]).default("column"),
            gap: z.string().optional(),
            align: z.string().optional(),
            justify: z.string().optional(),
            wrap: z.boolean().optional(),
          }).optional(),
          clip: z.boolean().optional(),
          styles: z.record(z.string(), z.unknown()).optional(),
        }),
        z.array(z.object({
          type: z.enum(["frame", "text", "image", "icon", "component", "vector"]),
          name: z.string(),
          children: z.array(z.any()).optional(),
          content: z.string().optional(),
          icon: z.string().optional(),
          src: z.string().optional(),
          alt: z.string().optional(),
          componentRef: z.string().optional(),
          props: z.record(z.string(), z.unknown()).optional(),
          layout: z.object({
            direction: z.enum(["row", "column", "none"]).default("column"),
            gap: z.string().optional(),
            align: z.string().optional(),
            justify: z.string().optional(),
            wrap: z.boolean().optional(),
          }).optional(),
          clip: z.boolean().optional(),
          styles: z.record(z.string(), z.unknown()).optional(),
        })),
      ]).describe("Nested tree definition (single object or array)"),
    },
    async ({ pageId, parentId, tree }) => {
      try {
        const { flattenTree } = await import("../cli/flatten-tree.js");
        const nodes = flattenTree(tree as any, parentId);
        const nm = getNodeManager();
        const created = nm.add(pageId, nodes as any);
        await autoSave();
        const screenshot = await tryScreenshot(browserPool, getDocument(), "node:add_tree", { pageId, parentId });
        return okWithScreenshot({ created }, screenshot);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "node:update",
    "Update one or more existing nodes",
    {
      pageId: z.string().describe("Target page ID"),
      updates: z
        .array(
          z.object({
            id: z.string().optional().describe("Node ID to update"),
            nodeName: z.string().optional().describe("Node name to find (alternative to id)"),
            name: z.string().optional(),
            content: z.string().optional(),
            styles: z.record(z.string(), z.unknown()).optional(),
            layout: z.record(z.string(), z.unknown()).optional(),
            clip: z.boolean().optional().describe("Clip overflow content (for frame nodes)"),
            stroke: z.object({
              color: z.string(),
              width: z.union([z.string(), z.number()]),
              style: z.enum(["solid", "dashed", "dotted"]).default("solid"),
            }).optional().describe("Structured stroke (border)"),
            effects: z.array(z.discriminatedUnion("type", [
              z.object({ type: z.literal("shadow"), offsetX: z.string().default("0"), offsetY: z.string().default("4px"), blur: z.string().default("6px"), spread: z.string().default("0"), color: z.string().default("rgba(0,0,0,0.1)"), inset: z.boolean().default(false) }),
              z.object({ type: z.literal("blur"), radius: z.string() }),
              z.object({ type: z.literal("backdrop-blur"), radius: z.string() }),
            ])).optional().describe("Visual effects (shadow, blur, backdrop-blur)"),
            gradient: z.object({
              type: z.enum(["linear", "radial", "conic"]),
              angle: z.number().optional(),
              colors: z.array(z.object({ color: z.string(), position: z.number().min(0).max(1) })).min(2),
            }).optional().describe("Gradient fill"),
            props: z.record(z.string(), z.unknown()).optional(),
            overrides: z.record(z.string(), z.unknown()).optional(),
            icon: z.string().optional().describe("Icon reference (for icon nodes)"),
            src: z.string().optional().describe("Image source URL (for image nodes)"),
            alt: z.string().optional().describe("Image alt text (for image nodes)"),
            componentRef: z.string().optional().describe("Component reference ID (for component nodes)"),
          }).refine(
            (u) => u.id !== undefined || u.nodeName !== undefined,
            { message: "Either id or nodeName must be provided" }
          )
        )
        .describe("Array of updates"),
      autoFix: z.boolean().optional().describe("Automatically fix known style typos"),
    },
    async ({ pageId, updates, autoFix }) => {
      try {
        const fixes: StyleFix[] = [];
        if (autoFix) {
          for (const u of updates) {
            if (u.styles) {
              const result = autoFixStyles(u.styles as Record<string, unknown>);
              u.styles = result.fixed;
              fixes.push(...result.fixes);
            }
          }
        }
        const nm = getNodeManager();
        const updated = nm.update(pageId, updates);
        await autoSave();
        const warnings: StyleWarning[] = [];
        for (const u of updates) {
          if (u.styles) {
            warnings.push(...validateStyles(u.styles as Record<string, unknown>));
          }
        }
        const screenshot = await tryScreenshot(browserPool, getDocument(), "node:update", { pageId, updates });
        return okWithScreenshot({
          updated,
          ...(fixes.length > 0 ? { fixes } : {}),
          ...(warnings.length > 0 ? { warnings } : {}),
        }, screenshot);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "node:delete",
    "Delete a node from a page",
    {
      pageId: z.string().describe("Target page ID"),
      nodeId: z.string().describe("Node ID to delete"),
    },
    async ({ pageId, nodeId }) => {
      try {
        const nm = getNodeManager();
        nm.delete(pageId, nodeId);
        await autoSave();
        const screenshot = await tryScreenshot(browserPool, getDocument(), "node:delete", { pageId, nodeId });
        return okWithScreenshot({ deleted: nodeId }, screenshot);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "node:move",
    "Move a node to a different parent",
    {
      pageId: z.string().describe("Target page ID"),
      nodeId: z.string().describe("Node ID to move"),
      newParentId: z.string().describe("New parent frame ID"),
      index: z.number().optional().describe("Position among new siblings"),
    },
    async ({ pageId, nodeId, newParentId, index }) => {
      try {
        const nm = getNodeManager();
        nm.move(pageId, nodeId, newParentId, index);
        await autoSave();
        const screenshot = await tryScreenshot(browserPool, getDocument(), "node:move", { pageId, nodeId, newParentId });
        return okWithScreenshot({ moved: nodeId, newParent: newParentId }, screenshot);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "node:list",
    "List and search nodes on a page",
    {
      pageId: z.string().describe("Target page ID"),
      parentId: z.string().optional().describe("Filter to children of this parent"),
      type: z.string().optional().describe("Filter by node type"),
      search: z.string().optional().describe("Search by name (case-insensitive)"),
      depth: z.number().optional().describe("Max traversal depth"),
    },
    async ({ pageId, parentId, type, search, depth }) => {
      try {
        const nm = getNodeManager();
        const nodes = nm.list(pageId, { parentId, type, search, depth });
        const screenshot = await tryScreenshot(browserPool, getDocument(), "node:list", { pageId, parentId });
        return okWithScreenshot({ nodes, count: nodes.length }, screenshot);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "node:get",
    "Get a single node by ID",
    {
      pageId: z.string().describe("Target page ID"),
      nodeId: z.string().describe("Node ID"),
    },
    async ({ pageId, nodeId }) => {
      try {
        const nm = getNodeManager();
        const node = nm.get(pageId, nodeId);
        if (!node) {
          return fail(new Error(`Node "${nodeId}" not found on page "${pageId}"`));
        }
        const screenshot = await tryScreenshot(browserPool, getDocument(), "node:get", { pageId, nodeId });
        return okWithScreenshot({ id: nodeId, ...node }, screenshot);
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.tool(
    "node:inspect",
    "Inspect computed layout for nodes (dimensions, position, overflow, flex properties)",
    {
      pageId: z.string().describe("Target page ID"),
      nodeId: z.string().optional().describe("Node ID to inspect (defaults to root)"),
      depth: z.number().optional().describe("Max traversal depth"),
    },
    async ({ pageId, nodeId, depth }) => {
      try {
        if (!browserPool) {
          return fail(new Error("Browser pool not available. Puppeteer is required for node:inspect."));
        }
        const { inspectNodeLayout } = await import("../services/node-inspect.js");
        const result = await inspectNodeLayout(browserPool, getDocument(), pageId, nodeId, depth);
        return ok(result);
      } catch (e) {
        return fail(e);
      }
    }
  );
}
