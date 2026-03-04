import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Command } from "commander";
import { NodeManager } from "../core/node.js";
import { validateStyles, autoFixStyles } from "../core/style-validator.js";
import type { Document } from "../core/document.js";
import { withDocument, readDocument, readStdin, printJson, withScreenshot } from "./helpers.js";

/**
 * Coerce layout.wrap from string to boolean when received via stdin JSON.
 */
function coerceLayout(layout: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!layout) return layout;
  if ("wrap" in layout && typeof layout.wrap === "string") {
    layout.wrap = layout.wrap === "true";
  }
  if ("gap" in layout && typeof layout.gap === "number") {
    layout.gap = String(layout.gap);
  }
  return layout;
}

/**
 * Commander collect helper: accumulates repeated option values into an array.
 */
function collect(val: string, acc: string[]): string[] {
  acc.push(val);
  return acc;
}

/**
 * Parse "--style key=value" pairs into a styles object.
 * Numeric-looking values are converted to numbers.
 */
function parseStylePairs(pairs: string[]): Record<string, unknown> {
  const styles: Record<string, unknown> = {};
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) {
      throw new Error(`Invalid --style format: "${pair}" (expected key=value)`);
    }
    const key = pair.slice(0, eqIdx);
    const raw = pair.slice(eqIdx + 1);
    // Convert numeric-looking values to numbers
    const num = Number(raw);
    styles[key] = raw !== "" && !isNaN(num) ? num : raw;
  }
  return styles;
}

export function registerNodeCommands(program: Command): void {
  const node = program
    .command("node")
    .description("Manage nodes on a canvas page");

  // ── node add <file> ──────────────────────────────────────
  node
    .command("add")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--page <pageId>", "target page ID")
    .option("--parent <parentId>", "parent frame node ID", "root")
    .option("--parent-name <name>", "parent frame name (alternative to --parent ID)")
    .option("--type <type>", "node type (frame|text|image|icon|component|vector)")
    .option("--name <name>", "node name")
    .option("--content <content>", "text content (for text nodes)")
    .option("--icon <icon>", "icon reference (for icon nodes)")
    .option("--src <src>", "image source URL (for image nodes)")
    .option("--alt <alt>", "image alt text (for image nodes)")
    .option("--component-ref <ref>", "component reference (for component nodes)")
    .option("--stdin", "read node definitions as JSON array from stdin")
    .option("--tree", "read nested tree JSON from stdin (children are recursively created)")
    .option("--tree-file <path>", "read nested tree JSON from a file (children are recursively created)")
    .option("--auto-fix", "automatically fix known style typos")
    .option("--screenshot [path]", "show screenshot inline, or save to path if given")
    .description("Add one or more nodes to a page")
    .action(
      async (
        file: string,
        opts: {
          page: string;
          parent: string;
          parentName?: string;
          type?: string;
          name?: string;
          content?: string;
          icon?: string;
          src?: string;
          alt?: string;
          componentRef?: string;
          stdin?: boolean;
          tree?: boolean;
          treeFile?: string;
          autoFix?: boolean;
          screenshot?: string | true;
        }
      ) => {
        try {
          let nodes: Array<{
            type: string;
            name: string;
            parentId?: string;
            parentName?: string;
            content?: string;
            icon?: string;
            src?: string;
            alt?: string;
            componentRef?: string;
          }>;

          if (opts.tree || opts.treeFile) {
            const { flattenTree } = await import("./flatten-tree.js");
            const input = opts.treeFile
              ? await readFile(resolve(process.cwd(), opts.treeFile), "utf-8")
              : await readStdin();
            const parsed = JSON.parse(input);
            nodes = flattenTree(parsed, opts.parent);

            // Coerce layout properties
            for (const n of nodes) {
              if ((n as Record<string, unknown>).layout) {
                (n as Record<string, unknown>).layout = coerceLayout(
                  (n as Record<string, unknown>).layout as Record<string, unknown>
                );
              }
            }
          } else if (opts.stdin) {
            const input = await readStdin();
            const parsed = JSON.parse(input);
            nodes = Array.isArray(parsed) ? parsed : [parsed];

            // Coerce layout properties (e.g. wrap: "true" → true)
            for (const n of nodes) {
              if ((n as Record<string, unknown>).layout) {
                (n as Record<string, unknown>).layout = coerceLayout(
                  (n as Record<string, unknown>).layout as Record<string, unknown>
                );
              }
            }
          } else {
            if (!opts.type || !opts.name) {
              console.error("[!] --type and --name are required (or use --stdin)");
              process.exit(1);
            }
            nodes = [
              {
                type: opts.type,
                name: opts.name,
                parentId: opts.parentName ? undefined : opts.parent,
                parentName: opts.parentName,
                content: opts.content,
                icon: opts.icon,
                src: opts.src,
                alt: opts.alt,
                componentRef: opts.componentRef,
              },
            ];
          }

          // Auto-fix style typos if requested
          if (opts.autoFix) {
            for (const n of nodes) {
              const styles = (n as Record<string, unknown>).styles as Record<string, unknown> | undefined;
              if (styles) {
                const { fixed, fixes } = autoFixStyles(styles);
                (n as Record<string, unknown>).styles = fixed;
                for (const f of fixes) {
                  console.error(`[fix] "${f.original}" → "${f.corrected}"`);
                }
              }
            }
          }

          let doc: Document | undefined;
          const created = await withDocument(file, (d) => {
            doc = d;
            const nm = new NodeManager(d);
            return nm.add(
              opts.page,
              nodes.map((n) => ({
                ...n,
                parentId: n.parentId ?? (n.parentName ? undefined : opts.parent),
                type: n.type as "frame" | "text" | "image" | "icon" | "component" | "vector",
              }))
            );
          });

          printJson({ created });
          for (const n of nodes) {
            const styles = (n as Record<string, unknown>).styles as Record<string, unknown> | undefined;
            if (styles) {
              for (const w of validateStyles(styles)) {
                console.error(`[warn] ${w.message}`);
              }
            }
          }
          await withScreenshot(opts.screenshot, doc!, "node:add", { pageId: opts.page, nodes });
        } catch (err) {
          console.error(`[!] node add failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── node update <file> ───────────────────────────────────
  node
    .command("update")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--page <pageId>", "target page ID")
    .option("--id <nodeId>", "node ID to update")
    .option("--node-name <name>", "find node by name (alternative to --id)")
    .option("--name <name>", "new name")
    .option("--content <content>", "new text content")
    .option("--icon <icon>", "icon reference (for icon nodes)")
    .option("--src <src>", "image source URL (for image nodes)")
    .option("--alt <alt>", "image alt text (for image nodes)")
    .option("--style <keyValue>", "set style property (key=value, repeatable)", collect, [] as string[])
    .option("--stdin", "read update definitions as JSON array from stdin")
    .option("--auto-fix", "automatically fix known style typos")
    .option("--screenshot [path]", "show screenshot inline, or save to path if given")
    .description("Update one or more existing nodes")
    .action(
      async (
        file: string,
        opts: {
          page: string;
          id?: string;
          nodeName?: string;
          name?: string;
          content?: string;
          icon?: string;
          src?: string;
          alt?: string;
          style: string[];
          stdin?: boolean;
          autoFix?: boolean;
          screenshot?: string | true;
        }
      ) => {
        try {
          let updates: Array<{
            id?: string;
            nodeName?: string;
            name?: string;
            content?: string;
            styles?: Record<string, unknown>;
            layout?: object;
            props?: object;
            overrides?: object;
            icon?: string;
            src?: string;
            alt?: string;
            componentRef?: string;
          }>;

          if (opts.stdin) {
            const input = await readStdin();
            const parsed = JSON.parse(input);
            updates = Array.isArray(parsed) ? parsed : [parsed];

            // Coerce layout properties (e.g. wrap: "true" → true)
            for (const u of updates) {
              if (u.layout) {
                u.layout = coerceLayout(u.layout as Record<string, unknown>);
              }
            }
          } else {
            if (!opts.id && !opts.nodeName) {
              console.error("[!] --id or --node-name is required (or use --stdin)");
              process.exit(1);
            }

            const update: {
              id?: string;
              nodeName?: string;
              name?: string;
              content?: string;
              icon?: string;
              src?: string;
              alt?: string;
              styles?: Record<string, unknown>;
            } = {
              id: opts.id,
              nodeName: opts.nodeName,
              name: opts.name,
              content: opts.content,
              icon: opts.icon,
              src: opts.src,
              alt: opts.alt,
            };

            // Parse --style key=value pairs
            if (opts.style.length > 0) {
              update.styles = parseStylePairs(opts.style);
            }

            updates = [update];
          }

          // Auto-fix style typos if requested
          if (opts.autoFix) {
            for (const u of updates) {
              if (u.styles) {
                const { fixed, fixes } = autoFixStyles(u.styles);
                u.styles = fixed;
                for (const f of fixes) {
                  console.error(`[fix] "${f.original}" → "${f.corrected}"`);
                }
              }
            }
          }

          let doc: Document | undefined;
          const updated = await withDocument(file, (d) => {
            doc = d;
            const nm = new NodeManager(d);
            return nm.update(opts.page, updates);
          });

          printJson({ updated });
          for (const u of updates) {
            if (u.styles) {
              for (const w of validateStyles(u.styles)) {
                console.error(`[warn] ${w.message}`);
              }
            }
          }
          await withScreenshot(opts.screenshot, doc!, "node:update", { pageId: opts.page, updates });
        } catch (err) {
          console.error(`[!] node update failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── node delete <file> ───────────────────────────────────
  node
    .command("delete")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--page <pageId>", "target page ID")
    .requiredOption("--id <nodeId>", "node ID to delete")
    .option("--screenshot [path]", "show screenshot inline, or save to path if given")
    .description("Delete a node from a page")
    .action(
      async (
        file: string,
        opts: { page: string; id: string; screenshot?: string }
      ) => {
        try {
          let doc: Document | undefined;
          await withDocument(file, (d) => {
            doc = d;
            const nm = new NodeManager(d);
            nm.delete(opts.page, opts.id);
          });

          printJson({ deleted: opts.id });
          await withScreenshot(opts.screenshot, doc!, "node:delete", { pageId: opts.page, nodeId: opts.id });
        } catch (err) {
          console.error(`[!] node delete failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── node move <file> ─────────────────────────────────────
  node
    .command("move")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--page <pageId>", "target page ID")
    .requiredOption("--id <nodeId>", "node ID to move")
    .requiredOption("--to <parentId>", "new parent frame ID")
    .option("--index <number>", "position among new siblings")
    .option("--screenshot [path]", "show screenshot inline, or save to path if given")
    .description("Move a node to a different parent")
    .action(
      async (
        file: string,
        opts: { page: string; id: string; to: string; index?: string; screenshot?: string }
      ) => {
        try {
          const index = opts.index !== undefined ? parseInt(opts.index, 10) : undefined;

          let doc: Document | undefined;
          await withDocument(file, (d) => {
            doc = d;
            const nm = new NodeManager(d);
            nm.move(opts.page, opts.id, opts.to, index);
          });

          printJson({ moved: opts.id, newParent: opts.to });
          await withScreenshot(opts.screenshot, doc!, "node:move", { pageId: opts.page, nodeId: opts.id, newParentId: opts.to });
        } catch (err) {
          console.error(`[!] node move failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── node list <file> ─────────────────────────────────────
  node
    .command("list")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--page <pageId>", "target page ID")
    .option("--parent <parentId>", "filter to children of this parent")
    .option("--type <type>", "filter by node type")
    .option("--search <term>", "search by name (case-insensitive)")
    .option("--depth <number>", "max traversal depth")
    .option("--screenshot [path]", "show screenshot inline, or save to path if given")
    .description("List and search nodes on a page")
    .action(
      async (
        file: string,
        opts: {
          page: string;
          parent?: string;
          type?: string;
          search?: string;
          depth?: string;
          screenshot?: string | true;
        }
      ) => {
        try {
          const doc = await readDocument(file);
          const nm = new NodeManager(doc);
          const depth = opts.depth !== undefined ? parseInt(opts.depth, 10) : undefined;
          const nodes = nm.list(opts.page, {
            parentId: opts.parent,
            type: opts.type,
            search: opts.search,
            depth,
          });

          printJson({ nodes, count: nodes.length });
          await withScreenshot(opts.screenshot, doc, "node:list", { pageId: opts.page, parentId: opts.parent });
        } catch (err) {
          console.error(`[!] node list failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── node inspect <file> ─────────────────────────────────
  node
    .command("inspect")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--page <pageId>", "target page ID")
    .option("--id <nodeId>", "node ID to inspect (defaults to root)")
    .option("--depth <number>", "max traversal depth")
    .description("Inspect computed layout for nodes (requires Puppeteer)")
    .action(
      async (
        file: string,
        opts: {
          page: string;
          id?: string;
          depth?: string;
        }
      ) => {
        try {
          const doc = await readDocument(file);
          const depth = opts.depth !== undefined ? parseInt(opts.depth, 10) : undefined;

          const { BrowserPool } = await import("../preview/browser-pool.js");
          const { inspectNodeLayout } = await import("../services/node-inspect.js");
          const pool = new BrowserPool();
          try {
            const result = await inspectNodeLayout(pool, doc, opts.page, opts.id, depth);
            printJson(result);
          } finally {
            await pool.dispose();
          }
        } catch (err) {
          console.error(`[!] node inspect failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── node get <file> ──────────────────────────────────────
  node
    .command("get")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--page <pageId>", "target page ID")
    .requiredOption("--id <nodeId>", "node ID")
    .option("--screenshot [path]", "show screenshot inline, or save to path if given")
    .description("Get a single node by ID")
    .action(
      async (
        file: string,
        opts: { page: string; id: string; screenshot?: string }
      ) => {
        try {
          const doc = await readDocument(file);
          const nm = new NodeManager(doc);
          const node = nm.get(opts.page, opts.id);

          if (!node) {
            console.error(`[!] Node "${opts.id}" not found on page "${opts.page}"`);
            process.exit(1);
          }

          printJson({ id: opts.id, ...node });
          await withScreenshot(opts.screenshot, doc, "node:get", { pageId: opts.page, nodeId: opts.id });
        } catch (err) {
          console.error(`[!] node get failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );
}
