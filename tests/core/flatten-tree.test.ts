import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock crypto.randomUUID to return deterministic values
let uuidCounter = 0;
vi.mock("node:crypto", () => ({
  randomUUID: () => {
    uuidCounter++;
    return `${String(uuidCounter).padStart(8, "0")}-0000-0000-0000-000000000000`;
  },
}));

import { flattenTree } from "../../src/cli/flatten-tree.js";

describe("flattenTree", () => {
  beforeEach(() => {
    uuidCounter = 0;
  });

  it("flattens a single node with no children", () => {
    const result = flattenTree({ type: "text", name: "Hello", content: "World" }, "root");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("text");
    expect(result[0].name).toBe("Hello");
    expect(result[0].parentId).toBe("root");
    expect(result[0].content).toBe("World");
    expect(result[0].id).toBeDefined();
  });

  it("flattens a nested tree depth-first", () => {
    const tree = {
      type: "frame",
      name: "Parent",
      children: [
        { type: "text", name: "Child1", content: "A" },
        { type: "text", name: "Child2", content: "B" },
      ],
    };
    const result = flattenTree(tree, "root");
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Parent");
    expect(result[0].parentId).toBe("root");
    expect(result[1].name).toBe("Child1");
    expect(result[1].parentId).toBe(result[0].id);
    expect(result[2].name).toBe("Child2");
    expect(result[2].parentId).toBe(result[0].id);
  });

  it("handles deeply nested trees", () => {
    const tree = {
      type: "frame",
      name: "L1",
      children: [
        {
          type: "frame",
          name: "L2",
          children: [
            { type: "text", name: "L3", content: "Deep" },
          ],
        },
      ],
    };
    const result = flattenTree(tree, "root");
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("L1");
    expect(result[0].parentId).toBe("root");
    expect(result[1].name).toBe("L2");
    expect(result[1].parentId).toBe(result[0].id);
    expect(result[2].name).toBe("L3");
    expect(result[2].parentId).toBe(result[1].id);
  });

  it("handles an array of root nodes", () => {
    const trees = [
      { type: "text", name: "A", content: "1" },
      { type: "text", name: "B", content: "2" },
    ];
    const result = flattenTree(trees, "root");
    expect(result).toHaveLength(2);
    expect(result[0].parentId).toBe("root");
    expect(result[1].parentId).toBe("root");
  });

  it("preserves all node properties", () => {
    const tree = {
      type: "frame",
      name: "Styled",
      layout: { direction: "row" as const, gap: "8px" },
      styles: { backgroundColor: "#fff" },
      children: [],
    };
    const result = flattenTree(tree, "root");
    expect(result[0].layout).toEqual({ direction: "row", gap: "8px" });
    expect(result[0].styles).toEqual({ backgroundColor: "#fff" });
  });

  it("generates unique IDs for each node", () => {
    const tree = {
      type: "frame",
      name: "Parent",
      children: [
        { type: "text", name: "A", content: "1" },
        { type: "text", name: "B", content: "2" },
      ],
    };
    const result = flattenTree(tree, "root");
    const ids = result.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sets children array for frame nodes", () => {
    const tree = { type: "frame", name: "F", children: [] };
    const result = flattenTree(tree, "root");
    expect(result[0].children).toEqual([]);
  });

  it("handles icon nodes with icon property", () => {
    const tree = { type: "icon", name: "Menu", icon: "lucide:menu" };
    const result = flattenTree(tree, "root");
    expect(result[0].icon).toBe("lucide:menu");
  });

  it("handles image nodes with src and alt", () => {
    const tree = { type: "image", name: "Hero", src: "hero.png", alt: "Hero image" };
    const result = flattenTree(tree, "root");
    expect(result[0].src).toBe("hero.png");
    expect(result[0].alt).toBe("Hero image");
  });

  it("maps componentId to componentRef when componentRef is not provided", () => {
    const tree = { type: "component", name: "Btn", componentId: "PrimaryButton", props: { label: "OK" } };
    const result = flattenTree(tree, "root");
    expect(result[0].componentRef).toBe("PrimaryButton");
  });

  it("prefers componentRef over componentId when both are provided", () => {
    const tree = { type: "component", name: "Btn", componentRef: "RefButton", componentId: "IdButton", props: { label: "OK" } };
    const result = flattenTree(tree, "root");
    expect(result[0].componentRef).toBe("RefButton");
  });
});
