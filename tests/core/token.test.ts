import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenManager } from "../../src/core/token.js";
import {
  createTestDocument,
  createDocumentWithTokens,
} from "../helpers/create-test-document.js";
import type { Document } from "../../src/core/document.js";

describe("TokenManager", () => {
  let doc: Document;
  let tokens: TokenManager;

  beforeEach(() => {
    doc = createTestDocument();
    tokens = new TokenManager(doc);
  });

  // ----------------------------------------------------------------
  // set()
  // ----------------------------------------------------------------
  describe("set()", () => {
    it("should set a color token", () => {
      const result = tokens.set([
        { category: "colors", key: "primary", value: "#3b82f6" },
      ]);

      expect(result.set).toBe(1);
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it("should set a spacing token", () => {
      tokens.set([{ category: "spacing", key: "sm", value: "8px" }]);
      expect(tokens.get("spacing", "sm")).toEqual({ value: "8px" });
    });

    it("should set a borderRadius token", () => {
      tokens.set([{ category: "borderRadius", key: "md", value: "8px" }]);
      expect(tokens.get("borderRadius", "md")).toEqual({ value: "8px" });
    });

    it("should set a shadow token", () => {
      tokens.set([
        { category: "shadows", key: "sm", value: "0 1px 2px rgba(0,0,0,0.1)" },
      ]);
      expect(tokens.get("shadows", "sm")).toEqual({
        value: "0 1px 2px rgba(0,0,0,0.1)",
      });
    });

    it("should set a breakpoint token", () => {
      tokens.set([{ category: "breakpoints", key: "md", value: "768px" }]);
      expect(tokens.get("breakpoints", "md")).toEqual({ value: "768px" });
    });

    it("should set a typography token as object", () => {
      tokens.set([
        {
          category: "typography",
          key: "heading",
          value: {
            fontFamily: "Inter",
            fontSize: "24px",
            fontWeight: "700",
            lineHeight: "1.2",
          },
        },
      ]);

      const token = tokens.get("typography", "heading") as Record<string, unknown>;
      expect(token.fontFamily).toBe("Inter");
      expect(token.fontSize).toBe("24px");
      expect(token.fontWeight).toBe("700");
      expect(token.lineHeight).toBe("1.2");
    });

    it("should coerce numeric fontWeight, fontSize, lineHeight to strings", () => {
      tokens.set([
        {
          category: "typography",
          key: "heading",
          value: {
            fontFamily: "Inter",
            fontWeight: 700,
            fontSize: 24,
            lineHeight: 1.5,
          } as unknown as object,
        },
      ]);

      const token = tokens.get("typography", "heading") as Record<string, unknown>;
      expect(token.fontWeight).toBe("700");
      expect(token.fontSize).toBe("24");
      expect(token.lineHeight).toBe("1.5");
      expect(token.fontFamily).toBe("Inter");
    });

    it("should include description when provided", () => {
      tokens.set([
        {
          category: "colors",
          key: "accent",
          value: "#f59e0b",
          description: "Accent color",
        },
      ]);

      const token = tokens.get("colors", "accent") as Record<string, unknown>;
      expect(token.value).toBe("#f59e0b");
      expect(token.description).toBe("Accent color");
    });

    it("should include description on typography tokens", () => {
      tokens.set([
        {
          category: "typography",
          key: "body",
          value: {
            fontFamily: "Inter",
            fontSize: "16px",
            fontWeight: "400",
            lineHeight: "1.5",
          },
          description: "Body text style",
        },
      ]);

      const token = tokens.get("typography", "body") as Record<string, unknown>;
      expect(token.description).toBe("Body text style");
    });

    it("should overwrite existing token", () => {
      tokens.set([
        { category: "colors", key: "primary", value: "#3b82f6" },
      ]);
      tokens.set([
        { category: "colors", key: "primary", value: "#ef4444" },
      ]);

      const token = tokens.get("colors", "primary") as { value: string };
      expect(token.value).toBe("#ef4444");
    });

    it("should set multiple tokens at once", () => {
      const result = tokens.set([
        { category: "colors", key: "red", value: "#ef4444" },
        { category: "colors", key: "blue", value: "#3b82f6" },
        { category: "spacing", key: "lg", value: "32px" },
      ]);

      expect(result.set).toBe(3);
      expect(result.total).toBe(3);
    });

    it("should return correct total across categories", () => {
      tokens.set([
        { category: "colors", key: "a", value: "#000" },
        { category: "spacing", key: "b", value: "4px" },
      ]);

      const result = tokens.set([
        { category: "borderRadius", key: "c", value: "4px" },
      ]);

      expect(result.total).toBe(3);
    });

    it("should call doc.touch()", () => {
      const spy = vi.spyOn(doc, "touch");
      tokens.set([{ category: "colors", key: "x", value: "#fff" }]);
      expect(spy).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // get()
  // ----------------------------------------------------------------
  describe("get()", () => {
    it("should return a previously set token", () => {
      tokens.set([{ category: "colors", key: "primary", value: "#3b82f6" }]);
      const token = tokens.get("colors", "primary");
      expect(token).toEqual({ value: "#3b82f6" });
    });

    it("should return undefined for nonexistent key", () => {
      expect(tokens.get("colors", "nonexistent")).toBeUndefined();
    });

    it("should return undefined for empty category", () => {
      expect(tokens.get("spacing", "anything")).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // list()
  // ----------------------------------------------------------------
  describe("list()", () => {
    it("should return all tokens when no category specified", () => {
      tokens.set([
        { category: "colors", key: "primary", value: "#3b82f6" },
        { category: "spacing", key: "sm", value: "8px" },
      ]);

      const all = tokens.list();
      expect(all.colors).toHaveProperty("primary");
      expect(all.spacing).toHaveProperty("sm");
    });

    it("should return only specified category tokens", () => {
      tokens.set([
        { category: "colors", key: "primary", value: "#3b82f6" },
        { category: "spacing", key: "sm", value: "8px" },
      ]);

      const result = tokens.list("colors");
      expect(result.colors).toHaveProperty("primary");
      expect(Object.keys(result.spacing)).toHaveLength(0);
    });

    it("should return empty categories structure for nonexistent tokens", () => {
      const result = tokens.list("colors");
      expect(result.colors).toEqual({});
      expect(result.spacing).toEqual({});
      expect(result.typography).toEqual({});
    });

    it("should return all category keys in the response", () => {
      const result = tokens.list();
      expect(result).toHaveProperty("colors");
      expect(result).toHaveProperty("spacing");
      expect(result).toHaveProperty("typography");
      expect(result).toHaveProperty("borderRadius");
      expect(result).toHaveProperty("shadows");
      expect(result).toHaveProperty("breakpoints");
    });
  });

  // ----------------------------------------------------------------
  // delete()
  // ----------------------------------------------------------------
  describe("delete()", () => {
    it("should delete an existing token and return true", () => {
      tokens.set([{ category: "colors", key: "primary", value: "#3b82f6" }]);
      const result = tokens.delete("colors", "primary");
      expect(result).toBe(true);
      expect(tokens.get("colors", "primary")).toBeUndefined();
    });

    it("should return false when deleting nonexistent token", () => {
      const result = tokens.delete("colors", "nonexistent");
      expect(result).toBe(false);
    });

    it("should call doc.touch() on successful delete", () => {
      tokens.set([{ category: "colors", key: "del", value: "#000" }]);
      const spy = vi.spyOn(doc, "touch");
      tokens.delete("colors", "del");
      expect(spy).toHaveBeenCalled();
    });

    it("should not call doc.touch() on failed delete", () => {
      const spy = vi.spyOn(doc, "touch");
      tokens.delete("colors", "nonexistent");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // resolve()
  // ----------------------------------------------------------------
  describe("resolve()", () => {
    it("should resolve a simple token reference", () => {
      tokens.set([{ category: "colors", key: "primary", value: "#3b82f6" }]);
      expect(tokens.resolve("{colors.primary}")).toBe("#3b82f6");
    });

    it("should resolve a spacing token reference", () => {
      tokens.set([{ category: "spacing", key: "md", value: "16px" }]);
      expect(tokens.resolve("{spacing.md}")).toBe("16px");
    });

    it("should resolve token references with hyphenated keys", () => {
      tokens.set([
        { category: "colors", key: "text-muted", value: "#64748B" },
        { category: "colors", key: "text-light", value: "#CBD5E1" },
        { category: "spacing", key: "2xl", value: "48px" },
      ]);
      expect(tokens.resolve("{colors.text-muted}")).toBe("#64748B");
      expect(tokens.resolve("{colors.text-light}")).toBe("#CBD5E1");
      expect(tokens.resolve("{spacing.2xl}")).toBe("48px");
    });

    it("should recursively resolve nested references", () => {
      tokens.set([
        { category: "colors", key: "brand", value: "#3b82f6" },
        { category: "colors", key: "primary", value: "{colors.brand}" },
      ]);

      expect(tokens.resolve("{colors.primary}")).toBe("#3b82f6");
    });

    it("should return undefined for invalid format", () => {
      expect(tokens.resolve("not-a-ref")).toBeUndefined();
    });

    it("should return undefined for missing braces", () => {
      expect(tokens.resolve("colors.primary")).toBeUndefined();
    });

    it("should return undefined for invalid category", () => {
      expect(tokens.resolve("{invalid.key}")).toBeUndefined();
    });

    it("should return undefined for nonexistent key", () => {
      expect(tokens.resolve("{colors.nonexistent}")).toBeUndefined();
    });

    it("should return undefined for empty reference", () => {
      expect(tokens.resolve("{}")).toBeUndefined();
    });

    it("should resolve borderRadius references", () => {
      tokens.set([{ category: "borderRadius", key: "lg", value: "16px" }]);
      expect(tokens.resolve("{borderRadius.lg}")).toBe("16px");
    });
  });

  // ----------------------------------------------------------------
  // createDocumentWithTokens helper
  // ----------------------------------------------------------------
  describe("with pre-populated tokens", () => {
    it("should work with createDocumentWithTokens helper", () => {
      const preDoc = createDocumentWithTokens({
        colors: {
          primary: { value: "#3b82f6" },
          secondary: { value: "#6366f1" },
        },
      });
      const mgr = new TokenManager(preDoc);

      expect(mgr.get("colors", "primary")).toEqual({ value: "#3b82f6" });
      expect(mgr.get("colors", "secondary")).toEqual({ value: "#6366f1" });
    });
  });
});
