import { describe, it, expect } from "vitest";
import {
  resolveTokenRef,
  escapeHtml,
  escapeArbitraryValue,
  camelToKebab,
  stylesToClasses,
  layoutToClasses,
  textToSemanticTag,
  toComponentName,
  buildClassString,
} from "../../src/export/shared.js";
import type { Tokens } from "../../src/core/schema.js";

const emptyTokens: Tokens = {
  colors: {},
  spacing: {},
  typography: {},
  borderRadius: {},
  shadows: {},
  breakpoints: {},
};

describe("resolveTokenRef", () => {
  it("resolves a valid token reference", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      colors: { primary: { value: "#3b82f6" } },
    };
    expect(resolveTokenRef("{colors.primary}", tokens)).toBe("#3b82f6");
  });

  it("resolves a token reference with hyphenated key", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      colors: { "text-muted": { value: "#64748B" }, "text-light": { value: "#CBD5E1" } },
    };
    expect(resolveTokenRef("{colors.text-muted}", tokens)).toBe("#64748B");
    expect(resolveTokenRef("{colors.text-light}", tokens)).toBe("#CBD5E1");
  });

  it("resolves spacing tokens with hyphenated keys", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      spacing: { "2xl": { value: "48px" }, "3xl": { value: "64px" } },
    };
    expect(resolveTokenRef("{spacing.2xl}", tokens)).toBe("48px");
    expect(resolveTokenRef("{spacing.3xl}", tokens)).toBe("64px");
  });

  it("returns the original string if no match", () => {
    expect(resolveTokenRef("just-a-string", emptyTokens)).toBe(
      "just-a-string"
    );
  });

  it("returns the original ref if category not found", () => {
    expect(resolveTokenRef("{unknown.key}", emptyTokens)).toBe(
      "{unknown.key}"
    );
  });

  it("returns the original ref if key not found in category", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      colors: { primary: { value: "#3b82f6" } },
    };
    expect(resolveTokenRef("{colors.missing}", tokens)).toBe(
      "{colors.missing}"
    );
  });

  it("resolves typography tokens without .value as JSON string", () => {
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
    const result = resolveTokenRef("{typography.heading}", tokens);
    const parsed = JSON.parse(result);
    expect(parsed.fontFamily).toBe("Inter");
    expect(parsed.fontSize).toBe("32px");
    expect(parsed.fontWeight).toBe("bold");
    expect(parsed.lineHeight).toBe("1.2");
  });

  it("excludes description from typography token JSON output", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      typography: {
        body: {
          fontFamily: "Arial",
          fontSize: "16px",
          fontWeight: "normal",
          lineHeight: "1.5",
          description: "Body text style",
        },
      },
    };
    const result = resolveTokenRef("{typography.body}", tokens);
    const parsed = JSON.parse(result);
    expect(parsed.description).toBeUndefined();
    expect(parsed.fontFamily).toBe("Arial");
  });
});

describe("escapeHtml", () => {
  it("escapes & < > and quotes", () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot;"
    );
  });

  it("returns plain text unchanged", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("escapeArbitraryValue", () => {
  it("replaces spaces with underscores", () => {
    expect(escapeArbitraryValue("1px solid #475569")).toBe("1px_solid_#475569");
  });

  it("returns non-string values as strings", () => {
    expect(escapeArbitraryValue(42)).toBe("42");
  });

  it("leaves values without spaces unchanged", () => {
    expect(escapeArbitraryValue("#fff")).toBe("#fff");
  });
});

describe("camelToKebab", () => {
  it("converts camelCase to kebab-case", () => {
    expect(camelToKebab("borderBottom")).toBe("border-bottom");
  });

  it("converts multiple uppercase letters", () => {
    expect(camelToKebab("borderBottomWidth")).toBe("border-bottom-width");
  });

  it("leaves already-lowercase strings unchanged", () => {
    expect(camelToKebab("color")).toBe("color");
  });
});

describe("stylesToClasses", () => {
  it("returns empty string for undefined styles", () => {
    expect(stylesToClasses(undefined, emptyTokens)).toBe("");
  });

  it("maps backgroundColor", () => {
    expect(
      stylesToClasses({ backgroundColor: "#fff" }, emptyTokens)
    ).toBe("bg-[#fff]");
  });

  it("maps multiple styles", () => {
    const result = stylesToClasses(
      { padding: "16px", width: "100%" },
      emptyTokens
    );
    expect(result).toContain("p-[16px]");
    expect(result).toContain("w-[100%]");
  });

  it("maps fontWeight to named classes", () => {
    expect(
      stylesToClasses({ fontWeight: "bold" }, emptyTokens)
    ).toBe("font-bold");
    expect(
      stylesToClasses({ fontWeight: "semibold" }, emptyTokens)
    ).toBe("font-semibold");
    expect(
      stylesToClasses({ fontWeight: "medium" }, emptyTokens)
    ).toBe("font-medium");
    expect(
      stylesToClasses({ fontWeight: "light" }, emptyTokens)
    ).toBe("font-light");
  });

  it("maps overflow to overflow-{value}", () => {
    expect(
      stylesToClasses({ overflow: "hidden" }, emptyTokens)
    ).toBe("overflow-hidden");
  });

  it("resolves token references in style values", () => {
    const tokens: Tokens = {
      ...emptyTokens,
      colors: { primary: { value: "#3b82f6" } },
    };
    expect(
      stylesToClasses({ backgroundColor: "{colors.primary}" }, tokens)
    ).toBe("bg-[#3b82f6]");
  });

  it("maps textAlign to text-{value}", () => {
    expect(stylesToClasses({ textAlign: "center" }, emptyTokens)).toBe("text-center");
    expect(stylesToClasses({ textAlign: "left" }, emptyTokens)).toBe("text-left");
    expect(stylesToClasses({ textAlign: "right" }, emptyTokens)).toBe("text-right");
    expect(stylesToClasses({ textAlign: "justify" }, emptyTokens)).toBe("text-justify");
  });

  it("maps lineHeight to leading-[value]", () => {
    expect(stylesToClasses({ lineHeight: "1.5" }, emptyTokens)).toBe("leading-[1.5]");
    expect(stylesToClasses({ lineHeight: "24px" }, emptyTokens)).toBe("leading-[24px]");
  });

  it("maps letterSpacing to tracking-[value]", () => {
    expect(stylesToClasses({ letterSpacing: "2px" }, emptyTokens)).toBe("tracking-[2px]");
    expect(stylesToClasses({ letterSpacing: "0.05em" }, emptyTokens)).toBe("tracking-[0.05em]");
  });

  it("maps fontFamily to font-['value']", () => {
    expect(stylesToClasses({ fontFamily: "Inter" }, emptyTokens)).toBe("font-['Inter']");
    expect(stylesToClasses({ fontFamily: "Roboto Mono" }, emptyTokens)).toBe("font-['Roboto Mono']");
  });

  it("maps minHeight to min-h-[value]", () => {
    expect(stylesToClasses({ minHeight: "100vh" }, emptyTokens)).toBe("min-h-[100vh]");
  });

  it("maps maxWidth to max-w-[value]", () => {
    expect(stylesToClasses({ maxWidth: "1200px" }, emptyTokens)).toBe("max-w-[1200px]");
  });

  it("maps width to w-[value]", () => {
    expect(stylesToClasses({ width: "100%" }, emptyTokens)).toBe("w-[100%]");
  });

  it("escapes spaces in arbitrary values", () => {
    expect(
      stylesToClasses({ border: "1px solid #475569" }, emptyTokens)
    ).toBe("border-[1px_solid_#475569]");
  });

  it("uses kebab-case for unknown CSS properties in fallback", () => {
    expect(
      stylesToClasses({ borderBottom: "1px solid #334155" }, emptyTokens)
    ).toBe("[border-bottom:1px_solid_#334155]");
  });

  it("maps unknown styles as arbitrary properties with kebab-case", () => {
    expect(
      stylesToClasses({ zIndex: "10" }, emptyTokens)
    ).toBe("[z-index:10]");
  });
});

describe("layoutToClasses", () => {
  it("returns empty string for undefined layout", () => {
    expect(layoutToClasses(undefined, emptyTokens)).toBe("");
  });

  it("maps direction row to flex-row", () => {
    expect(
      layoutToClasses({ direction: "row" }, emptyTokens)
    ).toBe("flex flex-row");
  });

  it("maps direction column to flex-col", () => {
    expect(
      layoutToClasses({ direction: "column" }, emptyTokens)
    ).toBe("flex flex-col");
  });

  it("defaults to flex-col when direction is absent", () => {
    expect(layoutToClasses({}, emptyTokens)).toBe("flex flex-col");
  });

  it("maps gap", () => {
    const result = layoutToClasses({ gap: "16px" }, emptyTokens);
    expect(result).toContain("gap-[16px]");
  });

  it("maps align values", () => {
    expect(
      layoutToClasses({ align: "center" }, emptyTokens)
    ).toContain("items-center");
    expect(
      layoutToClasses({ align: "stretch" }, emptyTokens)
    ).toContain("items-stretch");
  });

  it("maps justify values", () => {
    expect(
      layoutToClasses({ justify: "between" }, emptyTokens)
    ).toContain("justify-between");
    expect(
      layoutToClasses({ justify: "evenly" }, emptyTokens)
    ).toContain("justify-evenly");
  });

  it("maps wrap to flex-wrap", () => {
    expect(
      layoutToClasses({ wrap: true }, emptyTokens)
    ).toContain("flex-wrap");
  });
});

describe("textToSemanticTag", () => {
  it("returns h1 for fontSize >= 32", () => {
    expect(textToSemanticTag({ fontSize: "32px" })).toBe("h1");
  });

  it("returns h1 when fontWeight is bold", () => {
    expect(
      textToSemanticTag({ fontSize: "16px", fontWeight: "bold" })
    ).toBe("h1");
  });

  it("returns h2 for fontSize >= 24 and < 32", () => {
    expect(textToSemanticTag({ fontSize: "24px" })).toBe("h2");
  });

  it("returns h3 for fontSize >= 20 and < 24", () => {
    expect(textToSemanticTag({ fontSize: "20px" })).toBe("h3");
  });

  it("returns p for fontSize < 20", () => {
    expect(textToSemanticTag({ fontSize: "14px" })).toBe("p");
  });

  it("returns p for undefined styles", () => {
    expect(textToSemanticTag(undefined)).toBe("p");
  });
});

describe("toComponentName", () => {
  it('converts "Hero Section" to "HeroSection"', () => {
    expect(toComponentName("Hero Section")).toBe("HeroSection");
  });

  it('converts "my-button" to "MyButton"', () => {
    expect(toComponentName("my-button")).toBe("MyButton");
  });

  it('converts "card_item" to "CardItem"', () => {
    expect(toComponentName("card_item")).toBe("CardItem");
  });

  it("handles single word", () => {
    expect(toComponentName("button")).toBe("Button");
  });

  it("handles already PascalCase", () => {
    expect(toComponentName("MyComponent")).toBe("MyComponent");
  });
});

describe("buildClassString", () => {
  it("combines layout and style classes", () => {
    const result = buildClassString(
      { direction: "row", gap: "8px" },
      { backgroundColor: "#fff" },
      emptyTokens
    );
    expect(result).toContain("flex flex-row");
    expect(result).toContain("gap-[8px]");
    expect(result).toContain("bg-[#fff]");
  });

  it("returns only style classes when no layout", () => {
    const result = buildClassString(
      undefined,
      { padding: "16px" },
      emptyTokens
    );
    expect(result).toBe("p-[16px]");
  });

  it("returns only layout classes when no styles", () => {
    const result = buildClassString(
      { direction: "column" },
      undefined,
      emptyTokens
    );
    expect(result).toBe("flex flex-col");
  });

  it("returns empty string when both are undefined", () => {
    expect(buildClassString(undefined, undefined, emptyTokens)).toBe("");
  });
});
