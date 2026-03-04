import type { Command } from "commander";
import { VariableManager } from "../core/variable.js";
import { withDocument, readDocument, readStdin, printJson } from "./helpers.js";

const VALID_TYPES = ["color", "spacing", "number", "string"] as const;

/**
 * Parse --theme argument as JSON object or key=value string.
 */
function parseThemeArg(theme: string): Record<string, string> {
  if (theme.startsWith("{")) {
    return JSON.parse(theme);
  }
  const [key, ...rest] = theme.split("=");
  return { [key]: rest.join("=") };
}

export function registerVariableCommands(program: Command): void {
  const variable = program
    .command("variable")
    .description("Manage design variables and themes");

  // ── variable set <file> ─────────────────────────────────────
  variable
    .command("set")
    .argument("<file>", "path to .canvas.json file")
    .option("--name <name>", "variable name")
    .option("--type <type>", "variable type (color|spacing|number|string)")
    .option("--value <value>", "variable value")
    .option("--theme <json>", "theme overrides as JSON or key=value")
    .option("--stdin", "read variable definitions as JSON array from stdin")
    .description("Set a variable")
    .action(
      async (
        file: string,
        opts: {
          name?: string;
          type?: string;
          value?: string;
          theme?: string;
          stdin?: boolean;
        }
      ) => {
        try {
          if (opts.stdin) {
            const input = await readStdin();
            const variables = JSON.parse(input) as Array<{
              name: string;
              type: string;
              value: string;
              theme?: Record<string, string>;
            }>;

            await withDocument(file, (doc) => {
              const vm = new VariableManager(doc);
              for (const v of variables) {
                if (!VALID_TYPES.includes(v.type as typeof VALID_TYPES[number])) {
                  throw new Error(`Invalid type: ${v.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
                }
                vm.set(v.name, v.type as typeof VALID_TYPES[number], v.value, v.theme);
              }
            });

            printJson({ set: variables.map((v) => v.name) });
          } else {
            if (!opts.name || !opts.type || !opts.value) {
              console.error("[!] --name, --type, and --value are required (or use --stdin)");
              process.exit(1);
            }

            if (!VALID_TYPES.includes(opts.type as typeof VALID_TYPES[number])) {
              console.error(`[!] Invalid type: ${opts.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
              process.exit(1);
            }

            let themeOverrides: Record<string, string> | undefined;
            if (opts.theme) {
              themeOverrides = parseThemeArg(opts.theme);
            }

            await withDocument(file, (doc) => {
              const vm = new VariableManager(doc);
              vm.set(opts.name!, opts.type as typeof VALID_TYPES[number], opts.value!, themeOverrides);
            });

            printJson({ set: opts.name });
          }
        } catch (err) {
          console.error(`[!] variable set failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── variable get <file> ─────────────────────────────────────
  variable
    .command("get")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--name <name>", "variable name")
    .option("--theme <json>", "theme context as JSON or key=value (e.g., mode=dark)")
    .description("Get a variable")
    .action(
      async (
        file: string,
        opts: { name: string; theme?: string }
      ) => {
        try {
          const doc = await readDocument(file);
          const vm = new VariableManager(doc);
          const v = vm.get(opts.name);

          if (v === undefined) {
            console.error(`[!] Variable "${opts.name}" not found`);
            process.exit(1);
          }

          if (opts.theme) {
            const themeContext = parseThemeArg(opts.theme);
            const resolved = vm.resolve(opts.name, themeContext);
            printJson({ name: opts.name, ...v, resolved });
          } else {
            printJson({ name: opts.name, ...v });
          }
        } catch (err) {
          console.error(`[!] variable get failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── variable delete <file> ──────────────────────────────────
  variable
    .command("delete")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--name <name>", "variable name")
    .description("Delete a variable")
    .action(
      async (
        file: string,
        opts: { name: string }
      ) => {
        try {
          const deleted = await withDocument(file, (doc) => {
            const vm = new VariableManager(doc);
            return vm.delete(opts.name);
          });

          if (!deleted) {
            console.error(`[!] Variable "${opts.name}" not found`);
            process.exit(1);
          }

          printJson({ deleted: opts.name });
        } catch (err) {
          console.error(`[!] variable delete failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── variable list <file> ────────────────────────────────────
  variable
    .command("list")
    .argument("<file>", "path to .canvas.json file")
    .description("List all variables")
    .action(
      async (file: string) => {
        try {
          const doc = await readDocument(file);
          const vm = new VariableManager(doc);
          const list = vm.list();
          printJson(list);
        } catch (err) {
          console.error(`[!] variable list failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── variable theme-axis <file> ──────────────────────────────
  variable
    .command("theme-axis")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--name <name>", "theme axis name")
    .option("--values <csv>", "comma-separated axis values")
    .option("--delete", "delete the theme axis")
    .description("Manage theme axes")
    .action(
      async (
        file: string,
        opts: {
          name: string;
          values?: string;
          delete?: boolean;
        }
      ) => {
        try {
          if (opts.delete) {
            const deleted = await withDocument(file, (doc) => {
              const vm = new VariableManager(doc);
              return vm.deleteThemeAxis(opts.name);
            });

            if (!deleted) {
              console.error(`[!] Theme axis "${opts.name}" not found`);
              process.exit(1);
            }

            printJson({ deleted: opts.name });
          } else {
            if (!opts.values) {
              console.error("[!] --values is required when not using --delete");
              process.exit(1);
            }

            await withDocument(file, (doc) => {
              const vm = new VariableManager(doc);
              vm.setThemeAxis(opts.name, opts.values!.split(","));
            });

            printJson({ set: opts.name, values: opts.values!.split(",") });
          }
        } catch (err) {
          console.error(`[!] variable theme-axis failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── variable export-css <file> ──────────────────────────────
  variable
    .command("export-css")
    .argument("<file>", "path to .canvas.json file")
    .description("Export variables as CSS custom properties")
    .action(
      async (file: string) => {
        try {
          const doc = await readDocument(file);
          const vm = new VariableManager(doc);
          const css = vm.toCssCustomProperties();
          console.log(css);
        } catch (err) {
          console.error(`[!] variable export-css failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );
}
