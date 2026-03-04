import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComponentRegistry } from "../../src/core/component.js";
import { createTestDocument } from "../helpers/create-test-document.js";
import type { Document } from "../../src/core/document.js";
import type { ComponentDefinition } from "../../src/core/schema.js";

function makeDefinition(
  overrides?: Partial<ComponentDefinition>
): ComponentDefinition {
  return {
    description: "A button component",
    variants: {},
    props: [],
    defaultProps: {},
    ...overrides,
  };
}

describe("ComponentRegistry", () => {
  let doc: Document;
  let registry: ComponentRegistry;

  beforeEach(() => {
    doc = createTestDocument();
    registry = new ComponentRegistry(doc);
  });

  // ----------------------------------------------------------------
  // create()
  // ----------------------------------------------------------------
  describe("create()", () => {
    it("should create a component", () => {
      const def = makeDefinition();
      registry.create("Button", def);
      expect(registry.get("Button")).toEqual(def);
    });

    it("should create a component with variants", () => {
      const def = makeDefinition({
        variants: {
          primary: { backgroundColor: "#3b82f6", color: "#fff" },
          secondary: { backgroundColor: "#e5e7eb", color: "#111" },
        },
      });
      registry.create("Button", def);

      const stored = registry.get("Button")!;
      expect(Object.keys(stored.variants)).toHaveLength(2);
      expect(stored.variants.primary).toEqual({
        backgroundColor: "#3b82f6",
        color: "#fff",
      });
    });

    it("should create a component with props", () => {
      const def = makeDefinition({
        props: ["label", "size", "disabled"],
        defaultProps: { label: "Click", size: "md", disabled: false },
      });
      registry.create("Button", def);

      const stored = registry.get("Button")!;
      expect(stored.props).toEqual(["label", "size", "disabled"]);
      expect(stored.defaultProps).toEqual({
        label: "Click",
        size: "md",
        disabled: false,
      });
    });

    it("should overwrite an existing component with same name", () => {
      registry.create("Button", makeDefinition({ description: "v1" }));
      registry.create("Button", makeDefinition({ description: "v2" }));

      expect(registry.get("Button")!.description).toBe("v2");
    });

    it("should call doc.touch()", () => {
      const spy = vi.spyOn(doc, "touch");
      registry.create("Card", makeDefinition());
      expect(spy).toHaveBeenCalled();
    });

    it("should throw when props is an object instead of an array", () => {
      expect(() =>
        registry.create("BadButton", {
          description: "Bad",
          variants: {},
          props: { label: "string" } as unknown as string[],
          defaultProps: {},
        })
      ).toThrow("Invalid component definition");
    });

    it("should accept valid definition after adding validation", () => {
      const def = makeDefinition({ props: ["label", "size"] });
      registry.create("ValidButton", def);
      const stored = registry.get("ValidButton")!;
      expect(stored.props).toEqual(["label", "size"]);
    });
  });

  // ----------------------------------------------------------------
  // get()
  // ----------------------------------------------------------------
  describe("get()", () => {
    it("should return an existing component", () => {
      const def = makeDefinition();
      registry.create("Button", def);
      expect(registry.get("Button")).toEqual(def);
    });

    it("should return undefined for nonexistent component", () => {
      expect(registry.get("NonExistent")).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // list()
  // ----------------------------------------------------------------
  describe("list()", () => {
    it("should return empty array when no components exist", () => {
      expect(registry.list()).toEqual([]);
    });

    it("should list all registered components", () => {
      registry.create("Button", makeDefinition({ props: ["label"] }));
      registry.create(
        "Card",
        makeDefinition({
          description: "A card",
          variants: { outlined: {}, filled: {} },
          props: ["title", "body"],
        })
      );

      const list = registry.list();
      expect(list).toHaveLength(2);

      const button = list.find((c) => c.name === "Button")!;
      expect(button.propsCount).toBe(1);
      expect(button.variantCount).toBe(0);

      const card = list.find((c) => c.name === "Card")!;
      expect(card.description).toBe("A card");
      expect(card.variantCount).toBe(2);
      expect(card.propsCount).toBe(2);
    });

    it("should include description in list output", () => {
      registry.create("Alert", makeDefinition({ description: "Alert box" }));
      const list = registry.list();
      expect(list[0].description).toBe("Alert box");
    });
  });

  // ----------------------------------------------------------------
  // delete()
  // ----------------------------------------------------------------
  describe("delete()", () => {
    it("should delete an existing component and return true", () => {
      registry.create("Button", makeDefinition());
      const result = registry.delete("Button");
      expect(result).toBe(true);
      expect(registry.get("Button")).toBeUndefined();
    });

    it("should return false when deleting nonexistent component", () => {
      expect(registry.delete("NonExistent")).toBe(false);
    });

    it("should call doc.touch() on successful delete", () => {
      registry.create("Button", makeDefinition());
      const spy = vi.spyOn(doc, "touch");
      registry.delete("Button");
      expect(spy).toHaveBeenCalled();
    });

    it("should not call doc.touch() on failed delete", () => {
      const spy = vi.spyOn(doc, "touch");
      registry.delete("NonExistent");
      expect(spy).not.toHaveBeenCalled();
    });

    it("should remove component from list after deletion", () => {
      registry.create("Button", makeDefinition());
      registry.create("Card", makeDefinition());
      registry.delete("Button");

      const list = registry.list();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("Card");
    });
  });
});
