import type { TokenCategory, Tokens } from "./schema.js";
import { Document } from "./document.js";

export class TokenManager {
  constructor(private doc: Document) {}

  set(
    tokens: Array<{
      category: TokenCategory;
      key: string;
      value: string | object;
      description?: string;
    }>
  ): { set: number; total: number } {
    let setCount = 0;

    for (const t of tokens) {
      const bucket = this.doc.data.tokens[t.category] as Record<string, unknown>;

      if (t.category === "typography" && typeof t.value === "object") {
        bucket[t.key] = {
          ...(t.value as object),
          ...(t.description !== undefined ? { description: t.description } : {}),
        };
        const entry = bucket[t.key] as Record<string, unknown>;
        for (const field of ["fontWeight", "fontSize", "lineHeight"]) {
          if (typeof entry[field] === "number") {
            entry[field] = String(entry[field]);
          }
        }
      } else {
        bucket[t.key] = {
          value: t.value as string,
          ...(t.description !== undefined ? { description: t.description } : {}),
        };
      }

      setCount++;
    }

    this.doc.touch();

    const total = this.countAll();
    return { set: setCount, total };
  }

  get(category: TokenCategory, key: string): unknown | undefined {
    const bucket = this.doc.data.tokens[category] as Record<string, unknown>;
    return bucket[key];
  }

  list(category?: TokenCategory): Tokens {
    if (category) {
      return {
        colors: {},
        spacing: {},
        typography: {},
        borderRadius: {},
        shadows: {},
        breakpoints: {},
        [category]: this.doc.data.tokens[category],
      } as Tokens;
    }
    return this.doc.data.tokens;
  }

  delete(category: TokenCategory, key: string): boolean {
    const bucket = this.doc.data.tokens[category] as Record<string, unknown>;
    if (!(key in bucket)) return false;
    delete bucket[key];
    this.doc.touch();
    return true;
  }

  resolve(ref: string): string | undefined {
    // Parse "{category.key}" format
    const match = ref.match(/^\{(\w+)\.([\w-]+)\}$/);
    if (!match) return undefined;

    const [, category, key] = match;
    const validCategories: TokenCategory[] = [
      "colors",
      "spacing",
      "typography",
      "borderRadius",
      "shadows",
      "breakpoints",
    ];

    if (!validCategories.includes(category as TokenCategory)) return undefined;

    const token = this.get(category as TokenCategory, key);
    if (!token) return undefined;

    if (typeof token === "object" && token !== null && "value" in token) {
      const val = (token as { value: string }).value;
      // Recursively resolve if the value is itself a reference
      if (val.startsWith("{") && val.endsWith("}")) {
        return this.resolve(val);
      }
      return val;
    }

    return undefined;
  }

  private countAll(): number {
    let count = 0;
    const tokens = this.doc.data.tokens;
    for (const cat of Object.values(tokens)) {
      count += Object.keys(cat as object).length;
    }
    return count;
  }
}
