import type { Command } from "commander";
import { ComponentRegistry } from "../core/component.js";
import type { ComponentDefinition } from "../core/schema.js";
import { withDocument, readDocument, readStdin, printJson } from "./helpers.js";

export function registerComponentCommands(program: Command): void {
  const component = program
    .command("component")
    .description("Manage reusable components");

  // ── component create <file> ──────────────────────────────
  component
    .command("create")
    .argument("<file>", "path to .canvas.json file")
    .option("--name <name>", "component name")
    .option("--description <desc>", "component description")
    .option("--stdin", "read component definition as JSON from stdin")
    .description("Create a reusable component")
    .action(
      async (
        file: string,
        opts: {
          name?: string;
          description?: string;
          stdin?: boolean;
        }
      ) => {
        try {
          let name: string;
          let definition: ComponentDefinition;

          if (opts.stdin) {
            const input = await readStdin();
            const parsed = JSON.parse(input);
            name = parsed.name;
            if (parsed.props !== undefined && !Array.isArray(parsed.props)) {
              throw new Error("props must be an array of strings, not an object");
            }
            definition = {
              description: parsed.description,
              variants: parsed.variants ?? {},
              props: parsed.props ?? [],
              defaultProps: parsed.defaultProps ?? {},
              template: parsed.template,
            };
          } else {
            if (!opts.name) {
              console.error("[!] --name is required (or use --stdin)");
              process.exit(1);
            }
            name = opts.name;
            definition = {
              description: opts.description,
              variants: {},
              props: [],
              defaultProps: {},
            };
          }

          await withDocument(file, (doc) => {
            const cr = new ComponentRegistry(doc);
            cr.create(name, definition);
          });

          printJson({ created: name });
        } catch (err) {
          console.error(`[!] component create failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── component get <file> ─────────────────────────────────
  component
    .command("get")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--name <name>", "component name")
    .description("Get a component definition")
    .action(async (file: string, opts: { name: string }) => {
      try {
        const doc = await readDocument(file);
        const cr = new ComponentRegistry(doc);
        const def = cr.get(opts.name);
        if (!def) {
          console.error(`[!] Component "${opts.name}" not found`);
          process.exit(1);
        }
        printJson({ name: opts.name, ...def });
      } catch (err) {
        console.error(`[!] component get failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── component list <file> ────────────────────────────────
  component
    .command("list")
    .argument("<file>", "path to .canvas.json file")
    .description("List all reusable components")
    .action(async (file: string) => {
      try {
        const doc = await readDocument(file);
        const cr = new ComponentRegistry(doc);
        const components = cr.list();

        printJson({ components, count: components.length });
      } catch (err) {
        console.error(`[!] component list failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── component delete <file> ────────────────────────────────
  component
    .command("delete")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--name <name>", "component name")
    .description("Delete a component")
    .action(async (file: string, opts: { name: string }) => {
      try {
        const deleted = await withDocument(file, (doc) => {
          const cr = new ComponentRegistry(doc);
          return cr.delete(opts.name);
        });
        if (!deleted) {
          console.error(`[!] Component "${opts.name}" not found`);
          process.exit(1);
        }
        printJson({ deleted: opts.name });
      } catch (err) {
        console.error(`[!] component delete failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
