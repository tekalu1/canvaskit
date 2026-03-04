import { describe, it, expect } from "vitest";
import { tokensToCssCustomProperties } from "../../src/export/css-tokens.js";
import type { Tokens } from "../../src/core/schema.js";

const emptyTokens: Tokens = {
  colors: {},
  spacing: {},
  typography: {},
  borderRadius: {},
  shadows: {},
  breakpoints: {},
};

describe("tokensToCssCustomProperties", () => {
  it("generates :root block", () => {
    const css = tokensToCssCustomProperties(emptyTokens);
    expect(css).toContain(":root {");
    expect(css).toContain("}");
  });

  it("generates color custom properties", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      colors: {
        primary: { value: "#3b82f6" },
        secondary: { value: "#6b7280" },
      },
    };
    const css = tokensToCssCustomProperties(tokens);
    expect(css).toContain("--colors-primary: #3b82f6;");
    expect(css).toContain("--colors-secondary: #6b7280;");
  });

  it("generates spacing custom properties", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      spacing: { md: { value: "16px" } },
    };
    const css = tokensToCssCustomProperties(tokens);
    expect(css).toContain("--spacing-md: 16px;");
  });

  it("generates typography custom properties with sub-properties", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      typography: {
        heading: {
          fontFamily: "Inter",
          fontSize: "32px",
          fontWeight: "bold",
          lineHeight: "1.2",
        },
      },
    };
    const css = tokensToCssCustomProperties(tokens);
    expect(css).toContain("--typography-heading-font-family: Inter;");
    expect(css).toContain("--typography-heading-font-size: 32px;");
    expect(css).toContain("--typography-heading-font-weight: bold;");
    expect(css).toContain("--typography-heading-line-height: 1.2;");
  });

  it("generates borderRadius custom properties", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      borderRadius: { md: { value: "8px" } },
    };
    const css = tokensToCssCustomProperties(tokens);
    expect(css).toContain("--borderRadius-md: 8px;");
  });

  it("generates shadow custom properties", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      shadows: { sm: { value: "0 1px 2px rgba(0,0,0,0.1)" } },
    };
    const css = tokensToCssCustomProperties(tokens);
    expect(css).toContain("--shadows-sm: 0 1px 2px rgba(0,0,0,0.1);");
  });

  it("generates breakpoint custom properties", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      breakpoints: { md: { value: "768px" } },
    };
    const css = tokensToCssCustomProperties(tokens);
    expect(css).toContain("--breakpoints-md: 768px;");
  });

  it("includes category comments", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      colors: { primary: { value: "#000" } },
    };
    const css = tokensToCssCustomProperties(tokens);
    expect(css).toContain("/* colors */");
  });

  it("skips empty categories", () => {
    const css = tokensToCssCustomProperties(emptyTokens);
    expect(css).not.toContain("/* colors */");
    expect(css).not.toContain("/* spacing */");
  });

  it("returns only :root wrapper for fully empty tokens", () => {
    const css = tokensToCssCustomProperties(emptyTokens);
    expect(css).toBe(":root {\n}");
  });
});
