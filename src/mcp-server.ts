import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createServer } from "node:http";

import { CanvasManager } from "./core/canvas.js";
import type { Document } from "./core/document.js";
import { BrowserPool } from "./preview/browser-pool.js";

import { registerCanvasTools } from "./tools/canvas-tools.js";
import { registerNodeTools } from "./tools/node-tools.js";
import { registerTokenTools } from "./tools/token-tools.js";
import { registerComponentTools } from "./tools/component-tools.js";
import { registerPageTools } from "./tools/page-tools.js";
import { registerVariableTools } from "./tools/variable-tools.js";
import { exportToHtml } from "./tools/export-tools.js";
import { generateTailwindConfig } from "./tools/tailwind-config.js";
import { exportToVueSfc } from "./export/vue-sfc.js";
import { exportToReactJsx } from "./export/react-jsx.js";
import { tokensToCssCustomProperties } from "./export/css-tokens.js";
import { startPreviewServer, type PreviewServerInfo } from "./preview/server.js";
import { takeScreenshot } from "./preview/screenshot.js";
import { exportToSvg } from "./export/svg.js";
import { importFromFigma } from "./import/figma.js";
import { generateImage } from "./services/image-generation.js";

// ============================================================
// Server State
// ============================================================

const canvasManager = new CanvasManager();
const browserPool = new BrowserPool();

function getDocument(): Document {
  const doc = canvasManager.document;
  if (!doc) {
    throw new Error("No document loaded. Use canvas:create or canvas:open first.");
  }
  return doc;
}

async function autoSave(): Promise<void> {
  if (canvasManager.document && canvasManager.filePath) {
    await canvasManager.save();
  }
}

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

// ============================================================
// MCP Server
// ============================================================

const server = new McpServer({
  name: "canvaskit",
  version: "0.1.0",
});

// Register tool groups from separate modules
registerCanvasTools(server, canvasManager, getDocument);
registerNodeTools(server, getDocument, autoSave, browserPool);
registerTokenTools(server, getDocument, autoSave);
registerComponentTools(server, getDocument, autoSave);
registerPageTools(server, getDocument, autoSave);
registerVariableTools(server, getDocument, autoSave);

// ------------------------------------------------------------
// export:html
// ------------------------------------------------------------
server.tool(
  "export:html",
  "Export a page as HTML with Tailwind CSS classes",
  {
    pageId: z.string().describe("Page ID to export"),
    nodeId: z.string().optional().describe("Export a specific subtree (defaults to root)"),
    outputPath: z.string().describe("Output file path for the HTML"),
    tailwindConfig: z.boolean().optional().describe("Also generate tailwind.config.js"),
  },
  async ({ pageId, nodeId, outputPath, tailwindConfig }) => {
    try {
      const doc = getDocument();
      const html = exportToHtml(doc, pageId, nodeId);

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, html, "utf-8");

      const result: Record<string, unknown> = {
        outputPath,
        size: Buffer.byteLength(html, "utf-8"),
      };

      if (tailwindConfig) {
        const configContent = generateTailwindConfig(doc.data.tokens);
        const configPath = dirname(outputPath) + "/tailwind.config.js";
        await writeFile(configPath, configContent, "utf-8");
        result.tailwindConfigPath = configPath;
      }

      return ok(result);
    } catch (e) {
      return fail(e);
    }
  }
);

// ------------------------------------------------------------
// export:vue
// ------------------------------------------------------------
server.tool(
  "export:vue",
  "Export a page as Vue SFC (.vue) files with Tailwind CSS classes",
  {
    pageId: z.string().describe("Page ID to export"),
    nodeId: z.string().optional().describe("Export a specific subtree (defaults to root)"),
    outputDir: z.string().describe("Output directory for Vue files"),
    options: z
      .object({
        composition: z.boolean().optional().describe("Use Composition API (default: true)"),
        typescript: z.boolean().optional().describe("Use TypeScript (default: true)"),
        scoped: z.boolean().optional().describe("Use scoped styles (default: false)"),
      })
      .optional()
      .describe("Vue SFC generation options"),
    tailwindConfig: z.boolean().optional().describe("Also generate tailwind.config.js"),
  },
  async ({ pageId, nodeId, outputDir, options, tailwindConfig }) => {
    try {
      const doc = getDocument();
      const result = exportToVueSfc(doc, pageId, nodeId, options);

      await mkdir(outputDir, { recursive: true });
      for (const file of result.files) {
        await writeFile(`${outputDir}/${file.path}`, file.content, "utf-8");
      }

      const response: Record<string, unknown> = {
        outputDir,
        files: result.files.map((f) => f.path),
        entryComponent: result.entryComponent,
      };

      if (tailwindConfig) {
        const configContent = generateTailwindConfig(doc.data.tokens);
        const configPath = `${outputDir}/tailwind.config.js`;
        await writeFile(configPath, configContent, "utf-8");
        response.tailwindConfigPath = configPath;
      }

      return ok(response);
    } catch (e) {
      return fail(e);
    }
  }
);

// ------------------------------------------------------------
// export:react
// ------------------------------------------------------------
server.tool(
  "export:react",
  "Export a page as React JSX/TSX files with Tailwind CSS classes",
  {
    pageId: z.string().describe("Page ID to export"),
    nodeId: z.string().optional().describe("Export a specific subtree (defaults to root)"),
    outputDir: z.string().describe("Output directory for React files"),
    options: z
      .object({
        typescript: z.boolean().optional().describe("Use TypeScript / TSX (default: true)"),
      })
      .optional()
      .describe("React JSX generation options"),
    tailwindConfig: z.boolean().optional().describe("Also generate tailwind.config.js"),
  },
  async ({ pageId, nodeId, outputDir, options, tailwindConfig }) => {
    try {
      const doc = getDocument();
      const result = exportToReactJsx(doc, pageId, nodeId, options);

      await mkdir(outputDir, { recursive: true });
      for (const file of result.files) {
        await writeFile(`${outputDir}/${file.path}`, file.content, "utf-8");
      }

      const response: Record<string, unknown> = {
        outputDir,
        files: result.files.map((f) => f.path),
        entryComponent: result.entryComponent,
      };

      if (tailwindConfig) {
        const configContent = generateTailwindConfig(doc.data.tokens);
        const configPath = `${outputDir}/tailwind.config.js`;
        await writeFile(configPath, configContent, "utf-8");
        response.tailwindConfigPath = configPath;
      }

      return ok(response);
    } catch (e) {
      return fail(e);
    }
  }
);

// ------------------------------------------------------------
// token:export_css
// ------------------------------------------------------------
server.tool(
  "token:export_css",
  "Export design tokens as CSS Custom Properties",
  {
    outputPath: z
      .string()
      .optional()
      .describe("Output file path. If omitted, CSS is returned in the response."),
  },
  async ({ outputPath }) => {
    try {
      const doc = getDocument();
      const css = tokensToCssCustomProperties(doc.data.tokens);

      if (outputPath) {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, css, "utf-8");
        return ok({
          outputPath,
          size: Buffer.byteLength(css, "utf-8"),
        });
      }

      return ok({ css });
    } catch (e) {
      return fail(e);
    }
  }
);

// ------------------------------------------------------------
// Preview server state
// ------------------------------------------------------------
let activePreview: PreviewServerInfo | null = null;

// ------------------------------------------------------------
// preview:start
// ------------------------------------------------------------
server.tool(
  "preview:start",
  "Start a local preview server for a canvas page with hot reload",
  {
    pageId: z.string().describe("Page ID to preview"),
    port: z.number().optional().describe("Server port (default: 3456)"),
  },
  async ({ pageId, port }) => {
    try {
      const doc = getDocument();

      // Stop existing preview if running
      if (activePreview) {
        await activePreview.stop();
        activePreview = null;
      }

      const info = await startPreviewServer(doc, pageId, undefined, {
        port: port ?? 3456,
        watchPath: canvasManager.filePath ?? undefined,
        onReload: () => {
          // Re-read the current document on file change
          return getDocument();
        },
      });

      activePreview = info;

      return ok({
        url: info.url,
        port: info.port,
        pageId,
        message: `Preview server running at ${info.url}`,
      });
    } catch (e) {
      return fail(e);
    }
  }
);

// ------------------------------------------------------------
// preview:stop
// ------------------------------------------------------------
server.tool(
  "preview:stop",
  "Stop the running preview server",
  {},
  async () => {
    try {
      if (!activePreview) {
        return ok({ message: "No preview server is running" });
      }

      const port = activePreview.port;
      await activePreview.stop();
      activePreview = null;

      return ok({ message: `Preview server on port ${port} stopped` });
    } catch (e) {
      return fail(e);
    }
  }
);

// ------------------------------------------------------------
// preview:screenshot
// ------------------------------------------------------------
server.tool(
  "preview:screenshot",
  "Take a screenshot of a canvas page (requires Puppeteer)",
  {
    pageId: z.string().describe("Page ID to screenshot"),
    nodeId: z.string().optional().describe("Specific node to screenshot"),
    format: z
      .enum(["png", "jpeg"])
      .optional()
      .describe("Image format (default: png)"),
    width: z.number().optional().describe("Viewport width (default: 1440)"),
    height: z.number().optional().describe("Viewport height (default: 900)"),
    outputPath: z
      .string()
      .optional()
      .describe("File path to save screenshot. If omitted, returns base64."),
  },
  async ({ pageId, nodeId, format, width, height, outputPath }) => {
    try {
      const doc = getDocument();
      const result = await takeScreenshot(doc, pageId, nodeId, {
        format,
        width,
        height,
      });

      if (outputPath) {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, result.buffer);
        return ok({
          outputPath,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.buffer.length,
        });
      }

      return ok({
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.buffer.length,
        base64: result.base64,
      });
    } catch (e) {
      return fail(e);
    }
  }
);

// ------------------------------------------------------------
// export:svg
// ------------------------------------------------------------
server.tool(
  "export:svg",
  "Export a page or node as an SVG file",
  {
    pageId: z.string().describe("Page ID to export"),
    nodeId: z.string().optional().describe("Specific node to export (defaults to root)"),
    outputPath: z
      .string()
      .optional()
      .describe("File path to save SVG. If omitted, returns SVG string."),
  },
  async ({ pageId, nodeId, outputPath }) => {
    try {
      const doc = getDocument();
      const result = exportToSvg(doc, pageId, nodeId);

      if (outputPath) {
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, result.svg, "utf-8");
        return ok({
          outputPath,
          width: result.width,
          height: result.height,
          size: Buffer.byteLength(result.svg, "utf-8"),
        });
      }

      return ok({
        svg: result.svg,
        width: result.width,
        height: result.height,
      });
    } catch (e) {
      return fail(e);
    }
  }
);

// ------------------------------------------------------------
// import:figma
// ------------------------------------------------------------
server.tool(
  "import:figma",
  "Import a design from Figma via the Figma API",
  {
    fileKey: z.string().describe("Figma file key (from URL)"),
    accessToken: z.string().describe("Figma Personal Access Token"),
    nodeIds: z
      .array(z.string())
      .optional()
      .describe("Import only specific node IDs"),
    outputPath: z
      .string()
      .optional()
      .describe("Output .canvas.json file path"),
    options: z
      .object({
        importImages: z.boolean().optional().describe("Import image references (default: true)"),
        importComponents: z.boolean().optional().describe("Import component definitions (default: true)"),
        extractTokens: z.boolean().optional().describe("Extract color/spacing tokens (default: true)"),
      })
      .optional()
      .describe("Import options"),
  },
  async ({ fileKey, accessToken, nodeIds, outputPath, options }) => {
    try {
      const result = await importFromFigma(
        fileKey,
        accessToken,
        nodeIds,
        options
      );

      if (outputPath) {
        await mkdir(dirname(outputPath), { recursive: true });
        const json = result.document.toJSON(true);
        await writeFile(outputPath, json, "utf-8");
      }

      // Load the imported document as current
      canvasManager.setDocument(result.document, outputPath);

      return ok({
        outputPath: outputPath ?? null,
        pages: result.pages,
        nodes: result.nodes,
        tokens: result.tokens,
        components: result.components,
      });
    } catch (e) {
      return fail(e);
    }
  }
);

// ------------------------------------------------------------
// image:generate
// ------------------------------------------------------------
server.tool(
  "image:generate",
  "Generate or find an image (stock or AI) and apply it to an image node",
  {
    pageId: z.string().describe("Page ID containing the image node"),
    nodeId: z.string().describe("Image node ID to update"),
    type: z.enum(["stock", "ai"]).describe("Image source: 'stock' for Unsplash, 'ai' for AI generation"),
    prompt: z.string().describe("Search keywords (stock) or generation prompt (AI)"),
    width: z.number().optional().describe("Desired image width"),
    height: z.number().optional().describe("Desired image height"),
  },
  async ({ pageId, nodeId, type, prompt, width, height }) => {
    try {
      const doc = getDocument();
      const page = doc.data.pages[pageId];
      if (!page) throw new Error(`Page "${pageId}" not found`);

      const node = page.nodes[nodeId];
      if (!node) throw new Error(`Node "${nodeId}" not found on page "${pageId}"`);
      if (node.type !== "image") {
        throw new Error(`Node "${nodeId}" is not an image node (type: ${node.type})`);
      }

      const result = await generateImage({ type, prompt, width, height });

      // Update the image node's src
      node.src = result.url;
      if (result.attribution) {
        node.alt = result.attribution;
      }
      doc.touch();
      await autoSave();

      return ok({
        nodeId,
        url: result.url,
        width: result.width,
        height: result.height,
        attribution: result.attribution,
      });
    } catch (e) {
      return fail(e);
    }
  }
);

// ------------------------------------------------------------
// guidelines:get
// ------------------------------------------------------------
server.tool(
  "guidelines:get",
  "Get design guidelines for AI-assisted design",
  {
    topic: z
      .string()
      .optional()
      .describe("Topic: layout, typography, color, spacing, components, responsive, accessibility"),
  },
  async ({ topic }) => {
    const guidelines: Record<string, string> = {
      layout: `## Layout Guidelines
- Use frames with flex layout (row/column) for all containers
- Set explicit gap values using spacing tokens
- Use "column" for vertical stacking, "row" for horizontal arrangements
- Nest frames to create complex layouts
- Keep the hierarchy shallow — aim for max 4-5 levels of nesting`,

      typography: `## Typography Guidelines
- Define typography tokens for consistent text styles
- Use semantic names: heading-xl, heading-lg, body, caption, label
- Set line-height to 1.4-1.6x the font size for body text
- Headings should use line-height of 1.1-1.3x
- Limit to 3-4 font sizes per design for consistency`,

      color: `## Color Guidelines
- Define a color palette using tokens: primary, secondary, accent, neutral
- Include semantic colors: success, warning, error, info
- Provide light/dark variants: primary-light, primary-dark
- Use consistent opacity values for overlays
- Ensure sufficient contrast ratios (4.5:1 for text, 3:1 for large text)`,

      spacing: `## Spacing Guidelines
- Use a consistent spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96
- Define named tokens: xs (4px), sm (8px), md (16px), lg (24px), xl (32px)
- Use gap property on frames instead of margin on children
- Maintain consistent padding within similar container types`,

      components: `## Component Guidelines
- Create components for any repeated UI pattern
- Define props for customizable content (text, icons, colors)
- Use variants for different states: default, hover, active, disabled
- Keep components small and composable
- Use semantic naming: Button, Card, Input, Badge, Avatar`,

      responsive: `## Responsive Design Guidelines
- Design mobile-first, then scale up
- Define breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Use relative units in tokens where possible
- Stack layouts vertically on small screens, horizontally on large
- Hide non-essential elements on mobile`,

      accessibility: `## Accessibility Guidelines
- Ensure all images have alt text
- Use semantic heading hierarchy (h1 > h2 > h3)
- Maintain minimum touch target size of 44x44px
- Provide sufficient color contrast
- Don't rely solely on color to convey meaning`,
    };

    if (topic && guidelines[topic]) {
      return ok({ topic, guidelines: guidelines[topic] });
    }

    return ok({
      availableTopics: Object.keys(guidelines),
      guidelines: Object.values(guidelines).join("\n\n"),
    });
  }
);

// ============================================================
// Browser pool cleanup
// ============================================================

process.on("beforeExit", async () => {
  await browserPool.dispose();
});
process.on("SIGINT", async () => {
  await browserPool.dispose();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await browserPool.dispose();
  process.exit(0);
});

// ============================================================
// Export start function
// ============================================================

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function startHttpMcpServer(port: number = 3100) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });
  await server.connect(transport);

  const httpServer = createServer(async (req, res) => {
    if (req.url === "/mcp") {
      await transport.handleRequest(req, res);
    } else if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", transport: "http", port }));
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, () => resolve());
  });

  return { port, httpServer };
}

export { server };
