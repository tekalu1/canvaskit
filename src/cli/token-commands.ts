import type { Command } from "commander";
import { TokenManager } from "../core/token.js";
import type { TokenCategory } from "../core/schema.js";
import { withDocument, readDocument, readStdin, printJson } from "./helpers.js";

const VALID_CATEGORIES: TokenCategory[] = [
  "colors",
  "spacing",
  "typography",
  "borderRadius",
  "shadows",
  "breakpoints",
];

export function registerTokenCommands(program: Command): void {
  const token = program
    .command("token")
    .description("Manage design tokens");

  // ── token set <file> ─────────────────────────────────────
  token
    .command("set")
    .argument("<file>", "path to .canvas.json file")
    .option("--category <category>", "token category (colors|spacing|typography|borderRadius|shadows|breakpoints)")
    .option("--key <key>", "token key")
    .option("--value <value>", "token value (string or JSON)")
    .option("--description <desc>", "token description")
    .option("--stdin", "read token definitions as JSON array from stdin")
    .description("Set one or more design tokens")
    .action(
      async (
        file: string,
        opts: {
          category?: string;
          key?: string;
          value?: string;
          description?: string;
          stdin?: boolean;
        }
      ) => {
        try {
          let tokens: Array<{
            category: TokenCategory;
            key: string;
            value: string | object;
            description?: string;
          }>;

          if (opts.stdin) {
            const input = await readStdin();
            tokens = JSON.parse(input);

            // Parse typography token values that are JSON strings into objects
            for (const t of tokens) {
              if (
                t.category === "typography" &&
                typeof t.value === "string"
              ) {
                try {
                  const parsed = JSON.parse(t.value);
                  if (typeof parsed === "object" && parsed !== null) {
                    t.value = parsed;
                  }
                } catch {
                  // Keep as string if not valid JSON
                }
              }
            }
          } else {
            if (!opts.category || !opts.key || !opts.value) {
              console.error("[!] --category, --key, and --value are required (or use --stdin)");
              process.exit(1);
            }
            if (!VALID_CATEGORIES.includes(opts.category as TokenCategory)) {
              console.error(`[!] Invalid category: ${opts.category}. Must be one of: ${VALID_CATEGORIES.join(", ")}`);
              process.exit(1);
            }

            // Try to parse value as JSON (for typography tokens which are objects)
            let value: string | object = opts.value;
            try {
              const parsed = JSON.parse(opts.value);
              if (typeof parsed === "object" && parsed !== null) {
                value = parsed;
              }
            } catch {
              // Keep as string
            }

            tokens = [
              {
                category: opts.category as TokenCategory,
                key: opts.key,
                value,
                description: opts.description,
              },
            ];
          }

          const result = await withDocument(file, (doc) => {
            const tm = new TokenManager(doc);
            return tm.set(tokens);
          });

          printJson(result);
        } catch (err) {
          console.error(`[!] token set failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── token get <file> ─────────────────────────────────────
  token
    .command("get")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--category <category>", "token category")
    .requiredOption("--key <key>", "token key")
    .description("Get a single design token")
    .action(
      async (
        file: string,
        opts: { category: string; key: string }
      ) => {
        try {
          const doc = await readDocument(file);
          const tm = new TokenManager(doc);
          const token = tm.get(opts.category as TokenCategory, opts.key);

          if (token === undefined) {
            console.error(`[!] Token "${opts.category}.${opts.key}" not found`);
            process.exit(1);
          }

          printJson({ category: opts.category, key: opts.key, ...token as object });
        } catch (err) {
          console.error(`[!] token get failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );

  // ── token delete <file> ──────────────────────────────────
  token
    .command("delete")
    .argument("<file>", "path to .canvas.json file")
    .requiredOption("--category <category>", "token category")
    .requiredOption("--key <key>", "token key")
    .description("Delete a design token")
    .action(
      async (
        file: string,
        opts: { category: string; key: string }
      ) => {
        try {
          const deleted = await withDocument(file, (doc) => {
            const tm = new TokenManager(doc);
            return tm.delete(opts.category as TokenCategory, opts.key);
          });

          if (!deleted) {
            console.error(`[!] Token "${opts.category}.${opts.key}" not found`);
            process.exit(1);
          }

          printJson({ deleted: `${opts.category}.${opts.key}` });
        } catch (err) {
          console.error(`[!] token delete failed: ${(err as Error).message}`);
          process.exit(1);
        }
      }
    );
}
