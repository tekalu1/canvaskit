import type { Command } from "commander";
import { PageManager } from "../core/page.js";
import { withDocument, readDocument, readStdin, printJson, withScreenshot } from "./helpers.js";

export function registerPageCommands(program: Command): void {
  const page = program
    .command("page")
    .description("Manage pages in a canvas document");

  // ── page add <file> ─────────────────────────────────────────
  page
    .command("add")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--id <pageId>", "page ID")
    .option("--name <name>", "page name")
    .option("--width <number>", "page width", "1440")
    .option("--height <number>", "page height (omit for auto)")
    .option("--x <number>", "artboard X position")
    .option("--y <number>", "artboard Y position")
    .description("Add a new page")
    .action(async (file: string, opts: { id: string; name?: string; width: string; height?: string; x?: string; y?: string }) => {
      try {
        const pageName = opts.name ?? opts.id;
        const width = parseInt(opts.width, 10);
        const height = opts.height ? parseInt(opts.height, 10) : null;

        let x: number
        let y: number

        await withDocument(file, (doc) => {
          if (opts.x !== undefined) {
            x = Number(opts.x)
          } else {
            // Auto-placement: maxX + maxWidth + 100
            let autoX = 0
            for (const page of Object.values(doc.data.pages)) {
              const rightEdge = page.x + page.width
              if (rightEdge > autoX) autoX = rightEdge
            }
            if (Object.keys(doc.data.pages).length > 0) {
              autoX += 100
            }
            x = autoX
          }
          y = opts.y !== undefined ? Number(opts.y) : 0

          doc.addPage(opts.id, {
            name: pageName,
            width,
            height,
            x,
            y,
            nodes: {
              root: {
                type: "frame" as const,
                name: "Root",
                clip: false,
                layout: { direction: "column" as const },
                children: [],
              },
            },
          });
        });

        printJson({ added: { id: opts.id, name: pageName, width, height, x: x!, y: y! } });
      } catch (err) {
        console.error(`[!] page add failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── page update <file> ──────────────────────────────────────
  page
    .command("update")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--page <pageId>", "page ID to update")
    .option("--name <name>", "new page name")
    .option("--width <number>", "new page width")
    .option("--height <number>", "new page height (use 'null' to unset)")
    .option("--x <number>", "artboard X position")
    .option("--y <number>", "artboard Y position")
    .option("--stdin", "read update as JSON from stdin")
    .option("--screenshot [path]", "show screenshot inline, or save to path if given")
    .description("Update page properties (name, width, height, x, y)")
    .action(
      async (
        file: string,
        opts: {
          page: string;
          name?: string;
          width?: string;
          height?: string;
          x?: string;
          y?: string;
          stdin?: boolean;
          screenshot?: string | true;
        }
      ) => {
        try {
          let updates: { name?: string; width?: number; height?: number | null; x?: number; y?: number };

          if (opts.stdin) {
            const input = await readStdin();
            updates = JSON.parse(input);
          } else {
            updates = {};
            if (opts.name !== undefined) updates.name = opts.name;
            if (opts.width !== undefined) updates.width = parseInt(opts.width, 10);
            if (opts.height !== undefined) {
              updates.height = opts.height === "null" ? null : parseInt(opts.height, 10);
            }
            if (opts.x !== undefined) updates.x = Number(opts.x);
            if (opts.y !== undefined) updates.y = Number(opts.y);
          }

          let doc: import("../core/document.js").Document | undefined;
          const result = await withDocument(file, (d) => {
            doc = d;
            const pm = new PageManager(d);
            return pm.update(opts.page, updates);
          });

          printJson({ updated: result });
          await withScreenshot(opts.screenshot, doc!, "page:update", { pageId: opts.page });
        } catch (err) {
          console.error(`[!] page update failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── page list <file> ────────────────────────────────────────
  page
    .command("list")
    .argument("<file>", "path to .canvas.json file")
    .option("--screenshot [path]", "show screenshot inline, or save to path if given")
    .description("List all pages in a canvas document")
    .action(
      async (
        file: string,
        opts: { screenshot?: string | true }
      ) => {
        try {
          const doc = await readDocument(file);
          const pm = new PageManager(doc);
          const pages = pm.list();

          printJson({ pages, count: pages.length });
          await withScreenshot(opts.screenshot, doc, "page:list", {});
        } catch (err) {
          console.error(`[!] page list failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── page delete <file> ────────────────────────────────────────
  page
    .command("delete")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--page <pageId>", "page ID to delete")
    .description("Delete a page")
    .action(async (file: string, opts: { page: string }) => {
      try {
        await withDocument(file, (doc) => {
          doc.removePage(opts.page);
        });
        printJson({ deleted: opts.page });
      } catch (err) {
        console.error(`[!] page delete failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
