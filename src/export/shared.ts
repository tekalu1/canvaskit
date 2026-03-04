import type { TokenCategory, Tokens, Stroke, Effect, Gradient } from "../core/schema.js";

/**
 * Resolve a token reference like "{colors.primary}" to its actual value.
 * Typography tokens store {fontFamily, fontSize, fontWeight, lineHeight}
 * directly without a .value wrapper -- for those, returns a JSON string.
 */
export function resolveTokenRef(ref: string, tokens: Tokens): string {
  const match = ref.match(/^\{(\w+)\.([\w-]+)\}$/);
  if (!match) return ref;

  const [, category, key] = match;
  const cat = tokens[category as TokenCategory];
  if (!cat) return ref;

  const entry = (cat as Record<string, Record<string, unknown>>)[key];
  if (!entry) return ref;

  if ("value" in entry && typeof entry.value === "string") {
    return entry.value;
  }

  // Typography tokens have no .value -- they store properties directly.
  if (category === "typography" && typeof entry === "object") {
    const { description: _desc, ...props } = entry;
    return JSON.stringify(props);
  }

  return ref;
}

/**
 * Escape HTML entities to prevent XSS.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Replace spaces with underscores in Tailwind arbitrary values.
 * Tailwind interprets spaces as class separators, so `border-[1px solid #000]`
 * must become `border-[1px_solid_#000]`.
 */
export function escapeArbitraryValue(value: unknown): string {
  return String(value).replace(/ /g, "_");
}

/**
 * Convert a camelCase string to kebab-case.
 * e.g. "borderBottom" → "border-bottom", "fontSize" → "font-size"
 */
export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Convert a styles record to Tailwind-compatible class strings.
 */
export function stylesToClasses(
  styles: Record<string, unknown> | undefined,
  tokens: Tokens
): string {
  if (!styles) return "";

  const classes: string[] = [];

  for (const [key, rawVal] of Object.entries(styles)) {
    const val =
      typeof rawVal === "string" ? resolveTokenRef(rawVal, tokens) : rawVal;
    const escaped = escapeArbitraryValue(val);

    switch (key) {
      case "backgroundColor":
        classes.push(`bg-[${escaped}]`);
        break;
      case "color":
        classes.push(`text-[${escaped}]`);
        break;
      case "padding":
        classes.push(`p-[${escaped}]`);
        break;
      case "paddingX":
        classes.push(`px-[${escaped}]`);
        break;
      case "paddingY":
        classes.push(`py-[${escaped}]`);
        break;
      case "margin":
        classes.push(`m-[${escaped}]`);
        break;
      case "width":
        classes.push(`w-[${escaped}]`);
        break;
      case "height":
        classes.push(`h-[${escaped}]`);
        break;
      case "minHeight":
        classes.push(`min-h-[${escaped}]`);
        break;
      case "maxWidth":
        classes.push(`max-w-[${escaped}]`);
        break;
      case "fontSize":
        classes.push(`text-[${escaped}]`);
        break;
      case "fontWeight":
        if (val === "bold") classes.push("font-bold");
        else if (val === "semibold") classes.push("font-semibold");
        else if (val === "medium") classes.push("font-medium");
        else if (val === "light") classes.push("font-light");
        else classes.push(`font-[${escaped}]`);
        break;
      case "fontFamily":
        classes.push(`font-['${val}']`);
        break;
      case "textAlign":
        classes.push(`text-${val}`);
        break;
      case "lineHeight":
        classes.push(`leading-[${escaped}]`);
        break;
      case "letterSpacing":
        classes.push(`tracking-[${escaped}]`);
        break;
      case "borderRadius":
        if (Array.isArray(rawVal)) {
          const [tl, tr, br, bl] = (rawVal as (string | number)[]).map(v => String(v));
          classes.push(`rounded-tl-[${tl}]`, `rounded-tr-[${tr}]`, `rounded-br-[${br}]`, `rounded-bl-[${bl}]`);
        } else {
          classes.push(`rounded-[${escaped}]`);
        }
        break;
      case "border":
        classes.push(`border-[${escaped}]`);
        break;
      case "shadow":
        classes.push(`shadow-[${escaped}]`);
        break;
      case "opacity":
        classes.push(`opacity-[${escaped}]`);
        break;
      case "overflow":
        classes.push(`overflow-${val}`);
        break;
      default:
        // Pass-through unknown styles as arbitrary properties
        classes.push(`[${camelToKebab(key)}:${escaped}]`);
        break;
    }
  }

  return classes.join(" ");
}

/**
 * Map layout properties to Tailwind flex classes.
 */
export function layoutToClasses(
  layout:
    | {
        direction?: string;
        gap?: string;
        align?: string;
        justify?: string;
        wrap?: boolean;
      }
    | undefined,
  tokens: Tokens
): string {
  if (!layout) return "";

  // "none" direction means absolute positioning (no flex)
  if (layout.direction === "none") {
    return "relative";
  }

  const classes: string[] = ["flex"];

  if (layout.direction === "row") {
    classes.push("flex-row");
  } else {
    classes.push("flex-col");
  }

  if (layout.gap) {
    const gap = resolveTokenRef(layout.gap, tokens);
    classes.push(`gap-[${gap}]`);
  }

  if (layout.align) {
    const alignMap: Record<string, string> = {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
    };
    classes.push(alignMap[layout.align] ?? `items-[${layout.align}]`);
  }

  if (layout.justify) {
    const justifyMap: Record<string, string> = {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    };
    classes.push(
      justifyMap[layout.justify] ?? `justify-[${layout.justify}]`
    );
  }

  if (layout.wrap) {
    classes.push("flex-wrap");
  }

  return classes.join(" ");
}

/**
 * Determine a semantic HTML tag based on text styles.
 */
export function textToSemanticTag(
  styles: Record<string, unknown> | undefined
): string {
  if (!styles) return "p";

  const fontSize = styles.fontSize;
  const fontWeight = styles.fontWeight;

  if (fontSize) {
    const sizeNum = parseInt(String(fontSize), 10);
    if (sizeNum >= 32 || fontWeight === "bold") return "h1";
    if (sizeNum >= 24) return "h2";
    if (sizeNum >= 20) return "h3";
  }

  return "p";
}

/**
 * Convert a human-readable name to a PascalCase component name.
 * e.g. "Hero Section" -> "HeroSection", "my-button" -> "MyButton"
 */
export function toComponentName(name: string): string {
  return name
    .replace(/[-_\s]+(.)?/g, (_, c: string | undefined) =>
      c ? c.toUpperCase() : ""
    )
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

/**
 * Convert a structured stroke to Tailwind classes.
 */
export function strokeToClasses(stroke: Stroke | undefined, tokens?: Tokens): string {
  if (!stroke) return "";
  const classes: string[] = [];
  const w = tokens ? resolveTokenRef(String(stroke.width), tokens) : stroke.width;
  classes.push(`border-[${escapeArbitraryValue(w)}]`);
  classes.push(`border-${stroke.style ?? "solid"}`);
  const c = tokens ? resolveTokenRef(stroke.color, tokens) : stroke.color;
  classes.push(`border-[${escapeArbitraryValue(c)}]`);
  return classes.join(" ");
}

/**
 * Convert an effects array to Tailwind classes.
 */
export function effectsToClasses(effects: Effect[] | undefined): string {
  if (!effects || effects.length === 0) return "";
  const classes: string[] = [];
  for (const effect of effects) {
    switch (effect.type) {
      case "shadow": {
        const inset = effect.inset ? "inset_" : "";
        const val = `${inset}${effect.offsetX}_${effect.offsetY}_${effect.blur}_${effect.spread}_${escapeArbitraryValue(effect.color)}`;
        classes.push(`shadow-[${val}]`);
        break;
      }
      case "blur":
        classes.push(`blur-[${escapeArbitraryValue(effect.radius)}]`);
        break;
      case "backdrop-blur":
        classes.push(`backdrop-blur-[${escapeArbitraryValue(effect.radius)}]`);
        break;
    }
  }
  return classes.join(" ");
}

/**
 * Convert a gradient definition to a CSS value string.
 */
export function gradientToCss(g: Gradient): string {
  const stops = g.colors
    .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
    .join(", ");
  switch (g.type) {
    case "linear":
      return `linear-gradient(${g.angle ?? 180}deg, ${stops})`;
    case "radial":
      return `radial-gradient(circle, ${stops})`;
    case "conic":
      return `conic-gradient(from ${g.angle ?? 0}deg, ${stops})`;
  }
}

/**
 * Convert a gradient to Tailwind class.
 */
export function gradientToClasses(gradient: Gradient | undefined): string {
  if (!gradient) return "";
  const css = gradientToCss(gradient);
  return `[background-image:${escapeArbitraryValue(css)}]`;
}

/**
 * Build a combined class string from layout + style classes for a node.
 */
export function buildClassString(
  layout:
    | {
        direction?: string;
        gap?: string;
        align?: string;
        justify?: string;
        wrap?: boolean;
      }
    | undefined,
  styles: Record<string, unknown> | undefined,
  tokens: Tokens
): string {
  const lc = layoutToClasses(layout, tokens);
  const sc = stylesToClasses(styles, tokens);
  return [lc, sc].filter(Boolean).join(" ");
}

/**
 * Build a full class string including visual primitives (stroke, effects, gradient).
 */
export function buildFullClassString(
  layout:
    | {
        direction?: string;
        gap?: string;
        align?: string;
        justify?: string;
        wrap?: boolean;
      }
    | undefined,
  styles: Record<string, unknown> | undefined,
  tokens: Tokens,
  stroke?: Stroke,
  effects?: Effect[],
  gradient?: Gradient
): string {
  const lc = layoutToClasses(layout, tokens);
  const sc = stylesToClasses(styles, tokens);
  const stk = strokeToClasses(stroke, tokens);
  const eff = effectsToClasses(effects);
  const grad = gradientToClasses(gradient);
  return [lc, sc, stk, eff, grad].filter(Boolean).join(" ");
}
