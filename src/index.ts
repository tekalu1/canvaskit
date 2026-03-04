#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CanvasManager } from "./core/canvas.js";
import { TokenManager } from "./core/token.js";
import {
  CanvasDocumentSchema,
  TOKEN_CATEGORIES,
  type Tokens,
} from "./core/schema.js";
import { tokensToCssCustomProperties } from "./export/css-tokens.js";
import { exportToVueSfc } from "./export/vue-sfc.js";
import { exportToReactJsx } from "./export/react-jsx.js";
import { registerNodeCommands } from "./cli/node-commands.js";
import { registerTokenCommands } from "./cli/token-commands.js";
import { registerComponentCommands } from "./cli/component-commands.js";
import { registerPageCommands } from "./cli/page-commands.js";
import { registerVariableCommands } from "./cli/variable-commands.js";
import { exportToHtml } from "./export/html.js";

const program = new Command();

program
  .name("canvaskit")
  .description("CLI-first MCP-native design canvas tool")
  .version("0.1.0");

// ── canvaskit init [name] ───────────────────────────────────
program
  .command("init")
  .argument("[name]", "canvas file name", "design")
  .option("--template <name>", "use a template (e.g., landing)")
  .option("--list-templates", "list available templates")
  .description("Create a new .canvas.json file")
  .action(async (name: string, opts: { template?: string; listTemplates?: boolean }) => {
    try {
      // Handle --list-templates
      if (opts.listTemplates) {
        const { listTemplates } = await import("./templates/index.js");
        const templates = listTemplates();
        if (templates.length === 0) {
          console.log("No templates available.");
        } else {
          console.log("Available templates:");
          for (const t of templates) {
            console.log(`  ${t.name} - ${t.description}`);
          }
        }
        return;
      }

      const filename = name.endsWith(".canvas.json")
        ? name
        : `${name}.canvas.json`;
      const filePath = resolve(process.cwd(), filename);

      if (opts.template) {
        const { getTemplate } = await import("./templates/index.js");
        const template = getTemplate(opts.template);
        if (!template) {
          console.error(`[!] Unknown template: "${opts.template}". Use --list-templates to see available templates.`);
          process.exit(1);
        }
        const docData = template.build();
        // Override the meta name with the provided name
        docData.meta.name = name;
        await mkdir(resolve(filePath, ".."), { recursive: true });
        await writeFile(filePath, JSON.stringify(docData, null, 2), "utf-8");
        console.log(`[+] Created ${filename} from template "${opts.template}"`);
        console.log(`    Path: ${filePath}`);
      } else {
        const manager = new CanvasManager();
        await manager.create(filePath, name);
        console.log(`[+] Created ${filename}`);
        console.log(`    Path: ${filePath}`);
      }
    } catch (err) {
      console.error(`[!] Failed to create canvas: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── canvaskit open <file> ───────────────────────────────────
program
  .command("open")
  .argument("<file>", "path to .canvas.json file")
  .description("Open a canvas file and display summary")
  .action(async (file: string) => {
    try {
      const filePath = resolve(process.cwd(), file);
      const manager = new CanvasManager();
      const doc = await manager.open(filePath);
      const data = doc.data;

      console.log(`\n--- Meta ---`);
      console.log(`  Name:     ${data.meta.name}`);
      console.log(`  Created:  ${data.meta.created}`);
      console.log(`  Modified: ${data.meta.modified}`);

      const pages = doc.listPages();
      console.log(`\n--- Pages (${pages.length}) ---`);
      for (const p of pages) {
        console.log(`  ${p.name} [${p.id}] - ${p.nodeCount} node(s)`);
      }

      console.log(`\n--- Tokens ---`);
      for (const cat of TOKEN_CATEGORIES) {
        const count = Object.keys(
          data.tokens[cat] as Record<string, unknown>
        ).length;
        if (count > 0) {
          console.log(`  ${cat}: ${count}`);
        }
      }

      const componentCount = Object.keys(data.components).length;
      if (componentCount > 0) {
        console.log(`\n--- Components: ${componentCount} ---`);
      }

      console.log("");
    } catch (err) {
      console.error(`[!] Failed to open file: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── canvaskit validate <file> ───────────────────────────────
program
  .command("validate")
  .argument("<file>", "path to .canvas.json file")
  .description("Validate a canvas file against the schema")
  .action(async (file: string) => {
    try {
      const filePath = resolve(process.cwd(), file);
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      const result = CanvasDocumentSchema.safeParse(parsed);

      if (result.success) {
        console.log(`[ok] ${file} is valid.`);
      } else {
        console.log(`[!!] ${file} is invalid.`);
        for (const issue of result.error.issues) {
          console.log(`  - ${issue.path.join(".")}: ${issue.message}`);
        }
        process.exit(1);
      }
    } catch (err) {
      console.error(`[!] Validation failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── canvaskit serve ─────────────────────────────────────────
program
  .command("serve")
  .description("Start the MCP server")
  .option("--transport <type>", "transport type (stdio|http)", "stdio")
  .option("--port <number>", "port for HTTP transport", "3100")
  .action(async (opts: { transport: string; port: string }) => {
    try {
      const mod = await import(
        /* webpackIgnore: true */ "./mcp-server.js"
      ) as {
        startMcpServer: () => Promise<void>;
        startHttpMcpServer: (port: number) => Promise<{ port: number }>;
      };

      if (opts.transport === "http") {
        const port = parseInt(opts.port, 10);
        const info = await mod.startHttpMcpServer(port);
        console.log(`[*] MCP server running at http://127.0.0.1:${info.port}/mcp`);
        return;
      }

      console.log("[*] Starting MCP server (stdio)...");
      await mod.startMcpServer();
    } catch (err) {
      console.error(`[!] Failed to start server: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── canvaskit export html <file> ────────────────────────────
const exportCmd = program
  .command("export")
  .description("Export a canvas to various formats");

exportCmd
  .command("html")
  .argument("<file>", "path to .canvas.json file")
  .requiredOption("-o, --output <dir>", "output directory")
  .option("--page <pageId>", "page ID to export (defaults to first page)")
  .description("Export canvas to HTML + Tailwind")
  .action(async (file: string, opts: { output: string; page?: string }) => {
    try {
      const filePath = resolve(process.cwd(), file);
      const outputDir = resolve(process.cwd(), opts.output);
      const manager = new CanvasManager();
      const doc = await manager.open(filePath);

      const pageId =
        opts.page ?? Object.keys(doc.data.pages)[0] ?? "page1";

      const html = exportToHtml(doc, pageId);

      await mkdir(outputDir, { recursive: true });
      const outputFile = `${outputDir}/index.html`;
      await writeFile(outputFile, html, "utf-8");

      console.log(`[+] Exported to ${outputDir}`);
      console.log(`    index.html`);
    } catch (err) {
      console.error(`[!] Export failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── canvaskit export vue <file> ─────────────────────────────
exportCmd
  .command("vue")
  .argument("<file>", "path to .canvas.json file")
  .requiredOption("-o, --output <dir>", "output directory")
  .option("--page <pageId>", "page ID to export (defaults to first page)")
  .option("--no-typescript", "generate plain JavaScript instead of TypeScript")
  .description("Export canvas to Vue SFC files + Tailwind")
  .action(
    async (
      file: string,
      opts: { output: string; page?: string; typescript: boolean }
    ) => {
      try {
        const filePath = resolve(process.cwd(), file);
        const outputDir = resolve(process.cwd(), opts.output);
        const manager = new CanvasManager();
        const doc = await manager.open(filePath);

        const pageId =
          opts.page ?? Object.keys(doc.data.pages)[0] ?? "page1";

        const result = exportToVueSfc(doc, pageId, undefined, {
          typescript: opts.typescript,
        });

        await mkdir(outputDir, { recursive: true });
        for (const f of result.files) {
          await writeFile(`${outputDir}/${f.path}`, f.content, "utf-8");
        }

        console.log(`[+] Exported Vue SFC to ${outputDir}`);
        for (const f of result.files) {
          console.log(`    ${f.path}`);
        }
      } catch (err) {
        console.error(`[!] Export failed: ${(err as Error).message}`);
        process.exit(1);
      }
    }
  );

// ── canvaskit export react <file> ───────────────────────────
exportCmd
  .command("react")
  .argument("<file>", "path to .canvas.json file")
  .requiredOption("-o, --output <dir>", "output directory")
  .option("--page <pageId>", "page ID to export (defaults to first page)")
  .option("--no-typescript", "generate plain JSX instead of TSX")
  .description("Export canvas to React JSX/TSX files + Tailwind")
  .action(
    async (
      file: string,
      opts: { output: string; page?: string; typescript: boolean }
    ) => {
      try {
        const filePath = resolve(process.cwd(), file);
        const outputDir = resolve(process.cwd(), opts.output);
        const manager = new CanvasManager();
        const doc = await manager.open(filePath);

        const pageId =
          opts.page ?? Object.keys(doc.data.pages)[0] ?? "page1";

        const result = exportToReactJsx(doc, pageId, undefined, {
          typescript: opts.typescript,
        });

        await mkdir(outputDir, { recursive: true });
        for (const f of result.files) {
          await writeFile(`${outputDir}/${f.path}`, f.content, "utf-8");
        }

        console.log(`[+] Exported React JSX to ${outputDir}`);
        for (const f of result.files) {
          console.log(`    ${f.path}`);
        }
      } catch (err) {
        console.error(`[!] Export failed: ${(err as Error).message}`);
        process.exit(1);
      }
    }
  );

// ── canvaskit export svg <file> ──────────────────────────────
exportCmd
  .command("svg")
  .argument("<file>", "path to .canvas.json file")
  .requiredOption("-o, --output <path>", "output file path (.svg)")
  .option("--page <pageId>", "page ID to export (defaults to first page)")
  .option("--node <nodeId>", "specific node to export")
  .description("Export canvas to SVG")
  .action(
    async (
      file: string,
      opts: { output: string; page?: string; node?: string }
    ) => {
      try {
        const filePath = resolve(process.cwd(), file);
        const outputPath = resolve(process.cwd(), opts.output);
        const manager = new CanvasManager();
        const doc = await manager.open(filePath);
        const pageId =
          opts.page ?? Object.keys(doc.data.pages)[0] ?? "page1";

        const { exportToSvg } = await import("./export/svg.js");
        const result = exportToSvg(doc, pageId, opts.node);

        await mkdir(resolve(outputPath, ".."), { recursive: true });
        await writeFile(outputPath, result.svg, "utf-8");

        console.log(`[+] Exported SVG to ${outputPath}`);
        console.log(`    Dimensions: ${result.width}x${result.height}`);
        console.log(
          `    Size: ${Buffer.byteLength(result.svg, "utf-8")} bytes`
        );
      } catch (err) {
        console.error(`[!] SVG export failed: ${(err as Error).message}`);
        process.exit(1);
      }
    }
  );

// ── canvaskit preview <file> ─────────────────────────────────
program
  .command("preview")
  .argument("<file>", "path to .canvas.json file")
  .option("--page <pageId>", "page ID to preview (defaults to first page)")
  .option("--port <number>", "server port", "3456")
  .description("Start a local preview server with hot reload")
  .action(
    async (
      file: string,
      opts: { page?: string; port: string }
    ) => {
      try {
        const filePath = resolve(process.cwd(), file);
        const manager = new CanvasManager();
        const doc = await manager.open(filePath);
        const pageId =
          opts.page ?? Object.keys(doc.data.pages)[0] ?? "page1";
        const port = parseInt(opts.port, 10);

        const { startPreviewServer } = await import(
          "./preview/server.js"
        );

        const info = await startPreviewServer(doc, pageId, undefined, {
          port,
          watchPath: filePath,
          savePath: filePath,
          onReload: async () => {
            return await manager.open(filePath);
          },
        });

        console.log(`[*] Preview server running at ${info.url}`);
        console.log(`    Page: ${pageId}`);
        console.log(`    Watching: ${filePath}`);
        console.log(`    Press Ctrl+C to stop`);

        // Keep process alive
        process.on("SIGINT", async () => {
          console.log("\n[*] Stopping preview server...");
          await info.stop();
          process.exit(0);
        });
      } catch (err) {
        console.error(
          `[!] Preview failed: ${(err as Error).message}`
        );
        process.exit(1);
      }
    }
  );

// ── canvaskit screenshot <file> ─────────────────────────────
program
  .command("screenshot")
  .argument("<file>", "path to .canvas.json file")
  .requiredOption("-o, --output <path>", "output file path (e.g., preview.png)")
  .option("--page <pageId>", "page ID to screenshot (defaults to first page)")
  .option("--node <nodeId>", "specific node to screenshot")
  .option("--format <type>", "image format (png|jpeg)", "png")
  .option("--width <number>", "viewport width", "1440")
  .option("--height <number>", "viewport height", "900")
  .description("Take a screenshot of a canvas page")
  .action(
    async (
      file: string,
      opts: {
        output: string;
        page?: string;
        node?: string;
        format: string;
        width: string;
        height: string;
      }
    ) => {
      try {
        const filePath = resolve(process.cwd(), file);
        const outputPath = resolve(process.cwd(), opts.output);
        const manager = new CanvasManager();
        const doc = await manager.open(filePath);
        const pageId =
          opts.page ?? Object.keys(doc.data.pages)[0] ?? "page1";

        const { takeScreenshot } = await import(
          "./preview/screenshot.js"
        );

        const result = await takeScreenshot(doc, pageId, opts.node, {
          format: opts.format as "png" | "jpeg",
          width: parseInt(opts.width, 10),
          height: parseInt(opts.height, 10),
        });

        await mkdir(resolve(outputPath, ".."), { recursive: true });
        await writeFile(outputPath, result.buffer);

        console.log(`[+] Screenshot saved to ${outputPath}`);
        console.log(
          `    Dimensions: ${result.width}x${result.height}`
        );
        console.log(`    Format: ${result.format}`);
        console.log(`    Size: ${result.buffer.length} bytes`);
      } catch (err) {
        console.error(
          `[!] Screenshot failed: ${(err as Error).message}`
        );
        process.exit(1);
      }
    }
  );

// ── canvaskit import figma ───────────────────────────────────
const importCmd = program
  .command("import")
  .description("Import designs from external tools");

importCmd
  .command("figma")
  .requiredOption("--file-key <key>", "Figma file key (from URL)")
  .requiredOption("--token <token>", "Figma Personal Access Token")
  .option("--nodes <ids>", "comma-separated node IDs to import")
  .option("-o, --output <path>", "output .canvas.json file path")
  .description("Import a design from Figma")
  .action(
    async (opts: {
      fileKey: string;
      token: string;
      nodes?: string;
      output?: string;
    }) => {
      try {
        const { importFromFigma } = await import("./import/figma.js");
        const nodeIds = opts.nodes
          ? opts.nodes.split(",").map((s) => s.trim())
          : undefined;

        console.log(`[*] Importing from Figma file ${opts.fileKey}...`);
        const result = await importFromFigma(
          opts.fileKey,
          opts.token,
          nodeIds
        );

        if (opts.output) {
          const outputPath = resolve(process.cwd(), opts.output);
          await mkdir(resolve(outputPath, ".."), { recursive: true });
          await writeFile(
            outputPath,
            result.document.toJSON(true),
            "utf-8"
          );
          console.log(`[+] Saved to ${outputPath}`);
        }

        console.log(`    Pages: ${result.pages}`);
        console.log(`    Nodes: ${result.nodes}`);
        console.log(`    Tokens: ${result.tokens}`);
        console.log(`    Components: ${result.components}`);
      } catch (err) {
        console.error(
          `[!] Figma import failed: ${(err as Error).message}`
        );
        process.exit(1);
      }
    }
  );

// ── canvaskit tokens <file> ─────────────────────────────────
program
  .command("tokens")
  .argument("<file>", "path to .canvas.json file")
  .option("--format <type>", "output format (json|css|tailwind)", "json")
  .description("Display tokens from a canvas file")
  .action(async (file: string, opts: { format: string }) => {
    try {
      const filePath = resolve(process.cwd(), file);
      const manager = new CanvasManager();
      const doc = await manager.open(filePath);
      const tokenMgr = new TokenManager(doc);
      const tokens = tokenMgr.list();

      switch (opts.format) {
        case "json":
          console.log(JSON.stringify(tokens, null, 2));
          break;

        case "css":
          console.log(tokensToCssCustomProperties(tokens));
          break;

        case "tailwind":
          console.log(tokensToTailwindConfig(tokens));
          break;

        default:
          console.error(`[!] Unknown format: ${opts.format}`);
          process.exit(1);
      }
    } catch (err) {
      console.error(`[!] Failed to read tokens: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── Token format helpers ────────────────────────────────────

function tokensToTailwindConfig(tokens: Tokens): string {
  const theme: Record<string, Record<string, string>> = {};

  // colors
  const colors: Record<string, string> = {};
  for (const [key, token] of Object.entries(tokens.colors)) {
    colors[key] = token.value;
  }
  if (Object.keys(colors).length > 0) theme.colors = colors;

  // spacing
  const spacing: Record<string, string> = {};
  for (const [key, token] of Object.entries(tokens.spacing)) {
    spacing[key] = token.value;
  }
  if (Object.keys(spacing).length > 0) theme.spacing = spacing;

  // borderRadius
  const borderRadius: Record<string, string> = {};
  for (const [key, token] of Object.entries(tokens.borderRadius)) {
    borderRadius[key] = token.value;
  }
  if (Object.keys(borderRadius).length > 0) theme.borderRadius = borderRadius;

  // fontSize from typography
  const fontSize: Record<string, string> = {};
  for (const [key, token] of Object.entries(tokens.typography)) {
    fontSize[key] = token.fontSize;
  }
  if (Object.keys(fontSize).length > 0) theme.fontSize = fontSize;

  // fontFamily from typography
  const fontFamily: Record<string, string> = {};
  for (const [key, token] of Object.entries(tokens.typography)) {
    fontFamily[key] = token.fontFamily;
  }
  if (Object.keys(fontFamily).length > 0) theme.fontFamily = fontFamily;

  // boxShadow
  const boxShadow: Record<string, string> = {};
  for (const [key, token] of Object.entries(tokens.shadows)) {
    boxShadow[key] = token.value;
  }
  if (Object.keys(boxShadow).length > 0) theme.boxShadow = boxShadow;

  // screens from breakpoints
  const screens: Record<string, string> = {};
  for (const [key, token] of Object.entries(tokens.breakpoints)) {
    screens[key] = token.value;
  }
  if (Object.keys(screens).length > 0) theme.screens = screens;

  const config = {
    content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
    theme: { extend: theme },
    plugins: [],
  };

  return `/** @type {import('tailwindcss').Config} */\nexport default ${JSON.stringify(config, null, 2)};`;
}

registerNodeCommands(program);
registerTokenCommands(program);
registerComponentCommands(program);
registerPageCommands(program);
registerVariableCommands(program);

program.parseAsync().catch(() => {
  // Errors are already handled by each command's try/catch block.
  // This prevents Commander from printing a duplicate error message.
});
