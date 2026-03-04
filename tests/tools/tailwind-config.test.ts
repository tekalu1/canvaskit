import { describe, it, expect } from "vitest";
import { generateTailwindConfig } from "../../src/tools/tailwind-config.js";
import type { Tokens } from "../../src/core/schema.js";

function emptyTokens(): Tokens {
  return {
    colors: {},
    spacing: {},
    typography: {},
    borderRadius: {},
    shadows: {},
    breakpoints: {},
  };
}

describe("generateTailwindConfig", () => {
  it("returns a valid JS module string", () => {
    const result = generateTailwindConfig(emptyTokens());
    expect(result).toContain("/** @type {import('tailwindcss').Config} */");
    expect(result).toContain("export default");
  });

  it("includes content glob pattern", () => {
    const result = generateTailwindConfig(emptyTokens());
    const parsed = parseConfig(result);
    expect(parsed.content).toEqual(["./**/*.html"]);
  });

  it("maps colors to theme.extend.colors", () => {
    const tokens = emptyTokens();
    tokens.colors = {
      primary: { value: "#3b82f6" },
      secondary: { value: "#10b981" },
    };

    const parsed = parseConfig(generateTailwindConfig(tokens));
    expect(parsed.theme.extend.colors).toEqual({
      primary: "#3b82f6",
      secondary: "#10b981",
    });
  });

  it("maps spacing to theme.extend.spacing", () => {
    const tokens = emptyTokens();
    tokens.spacing = {
      sm: { value: "4px" },
      md: { value: "8px" },
    };

    const parsed = parseConfig(generateTailwindConfig(tokens));
    expect(parsed.theme.extend.spacing).toEqual({
      sm: "4px",
      md: "8px",
    });
  });

  it("maps borderRadius to theme.extend.borderRadius", () => {
    const tokens = emptyTokens();
    tokens.borderRadius = {
      sm: { value: "4px" },
      lg: { value: "12px" },
    };

    const parsed = parseConfig(generateTailwindConfig(tokens));
    expect(parsed.theme.extend.borderRadius).toEqual({
      sm: "4px",
      lg: "12px",
    });
  });

  it("maps shadows to theme.extend.boxShadow", () => {
    const tokens = emptyTokens();
    tokens.shadows = {
      md: { value: "0 4px 6px rgba(0,0,0,0.1)" },
    };

    const parsed = parseConfig(generateTailwindConfig(tokens));
    expect(parsed.theme.extend.boxShadow).toEqual({
      md: "0 4px 6px rgba(0,0,0,0.1)",
    });
  });

  it("maps breakpoints to theme.extend.screens", () => {
    const tokens = emptyTokens();
    tokens.breakpoints = {
      sm: { value: "640px" },
      lg: { value: "1024px" },
    };

    const parsed = parseConfig(generateTailwindConfig(tokens));
    expect(parsed.theme.extend.screens).toEqual({
      sm: "640px",
      lg: "1024px",
    });
  });

  it("maps typography to fontFamily and fontSize", () => {
    const tokens = emptyTokens();
    tokens.typography = {
      heading: {
        fontFamily: "Inter",
        fontSize: "32px",
        fontWeight: "700",
        lineHeight: "1.2",
      },
    };

    const parsed = parseConfig(generateTailwindConfig(tokens));
    expect(parsed.theme.extend.fontFamily).toEqual({
      heading: ["Inter"],
    });
    expect(parsed.theme.extend.fontSize).toEqual({
      heading: ["32px", { lineHeight: "1.2", fontWeight: "700" }],
    });
  });

  it("omits empty categories from theme.extend", () => {
    const tokens = emptyTokens();
    tokens.colors = { primary: { value: "#000" } };

    const parsed = parseConfig(generateTailwindConfig(tokens));
    expect(parsed.theme.extend.colors).toBeDefined();
    expect(parsed.theme.extend.spacing).toBeUndefined();
    expect(parsed.theme.extend.borderRadius).toBeUndefined();
    expect(parsed.theme.extend.boxShadow).toBeUndefined();
    expect(parsed.theme.extend.screens).toBeUndefined();
  });

  it("generates minimal config for empty tokens", () => {
    const parsed = parseConfig(generateTailwindConfig(emptyTokens()));
    expect(parsed.theme.extend).toEqual({});
    expect(parsed.plugins).toEqual([]);
  });
});

/**
 * Helper to parse the generated JS module config into a plain object.
 * Strips the export default prefix and trailing semicolon.
 */
function parseConfig(configStr: string): any {
  const jsonPart = configStr
    .replace(/\/\*\*.*?\*\/\s*/s, "")
    .replace(/^export default\s*/, "")
    .replace(/;\s*$/, "");
  return JSON.parse(jsonPart);
}
