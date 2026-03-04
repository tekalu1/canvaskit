import { TOKEN_CATEGORIES, type Tokens } from "../core/schema.js";

/**
 * Convert design tokens to CSS Custom Properties (:root block).
 */
export function tokensToCssCustomProperties(tokens: Tokens): string {
  const lines: string[] = [":root {"];

  for (const cat of TOKEN_CATEGORIES) {
    const bucket = tokens[cat] as Record<string, unknown>;
    const entries = Object.entries(bucket);
    if (entries.length === 0) continue;

    lines.push(`  /* ${cat} */`);
    for (const [key, token] of entries) {
      if (
        cat === "typography" &&
        typeof token === "object" &&
        token !== null
      ) {
        const t = token as Record<string, string>;
        lines.push(`  --${cat}-${key}-font-family: ${t.fontFamily ?? ""};`);
        lines.push(`  --${cat}-${key}-font-size: ${t.fontSize ?? ""};`);
        lines.push(`  --${cat}-${key}-font-weight: ${t.fontWeight ?? ""};`);
        lines.push(`  --${cat}-${key}-line-height: ${t.lineHeight ?? ""};`);
      } else if (
        typeof token === "object" &&
        token !== null &&
        "value" in token
      ) {
        lines.push(
          `  --${cat}-${key}: ${(token as { value: string }).value};`
        );
      }
    }
  }

  lines.push("}");
  return lines.join("\n");
}
