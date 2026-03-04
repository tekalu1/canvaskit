import { describe, it, expect, beforeEach } from "vitest";
import {
  figmaColorToHex,
  extractTokens,
  mapFigmaNode,
  mapFigmaComponents,
  buildComponentMap,
  resetIdCounter,
  type FigmaColor,
  type FigmaNode,
} from "../../src/import/figma-mapper.js";
import type { CanvasNode } from "../../src/core/schema.js";

// ============================================================
// figmaColorToHex
// ============================================================
describe("figmaColorToHex", () => {
  it("converts solid black", () => {
    expect(figmaColorToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe("#000000");
  });

  it("converts solid white", () => {
    expect(figmaColorToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe("#ffffff");
  });

  it("converts a mid-range color", () => {
    expect(figmaColorToHex({ r: 0.5, g: 0.25, b: 0.75, a: 1 })).toBe("#8040bf");
  });

  it("includes alpha channel when < 1", () => {
    const hex = figmaColorToHex({ r: 1, g: 0, b: 0, a: 0.5 });
    expect(hex).toBe("#ff000080");
  });

  it("omits alpha when exactly 1", () => {
    const hex = figmaColorToHex({ r: 0, g: 0.5, b: 1, a: 1 });
    expect(hex).not.toMatch(/#[0-9a-f]{8}/);
  });
});

// ============================================================
// extractTokens
// ============================================================
describe("extractTokens", () => {
  it("extracts colors from solid fills", () => {
    const node: FigmaNode = {
      id: "1",
      name: "test",
      type: "FRAME",
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
    };
    const tokens = extractTokens(node);
    expect(Object.keys(tokens.colors!)).toHaveLength(1);
    expect(Object.values(tokens.colors!)[0]!.value).toBe("#ff0000");
  });

  it("extracts spacing from itemSpacing", () => {
    const node: FigmaNode = {
      id: "1",
      name: "test",
      type: "FRAME",
      itemSpacing: 16,
    };
    const tokens = extractTokens(node);
    expect(Object.keys(tokens.spacing!)).toHaveLength(1);
    expect(Object.values(tokens.spacing!)[0]!.value).toBe("16px");
  });

  it("deduplicates identical colors", () => {
    const color: FigmaColor = { r: 0, g: 0, b: 1, a: 1 };
    const node: FigmaNode = {
      id: "1",
      name: "root",
      type: "FRAME",
      fills: [{ type: "SOLID", color }],
      children: [
        { id: "2", name: "child", type: "FRAME", fills: [{ type: "SOLID", color }] },
      ],
    };
    const tokens = extractTokens(node);
    expect(Object.keys(tokens.colors!)).toHaveLength(1);
  });

  it("walks children recursively", () => {
    const node: FigmaNode = {
      id: "1",
      name: "root",
      type: "FRAME",
      children: [
        {
          id: "2",
          name: "child",
          type: "FRAME",
          fills: [{ type: "SOLID", color: { r: 0, g: 1, b: 0, a: 1 } }],
          itemSpacing: 8,
        },
      ],
    };
    const tokens = extractTokens(node);
    expect(Object.keys(tokens.colors!).length).toBeGreaterThan(0);
    expect(Object.keys(tokens.spacing!).length).toBeGreaterThan(0);
  });

  it("ignores non-solid fills", () => {
    const node: FigmaNode = {
      id: "1",
      name: "test",
      type: "FRAME",
      fills: [{ type: "GRADIENT_LINEAR" }],
    };
    const tokens = extractTokens(node);
    expect(Object.keys(tokens.colors!)).toHaveLength(0);
  });

  it("ignores zero spacing", () => {
    const node: FigmaNode = {
      id: "1",
      name: "test",
      type: "FRAME",
      itemSpacing: 0,
    };
    const tokens = extractTokens(node);
    expect(Object.keys(tokens.spacing!)).toHaveLength(0);
  });
});

// ============================================================
// mapFigmaNode
// ============================================================
describe("mapFigmaNode", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it("maps TEXT nodes", () => {
    const nodes: Record<string, CanvasNode> = {};
    const figmaNode: FigmaNode = {
      id: "t1",
      name: "Title",
      type: "TEXT",
      characters: "Hello World",
      style: { fontSize: 24, fontWeight: 700 },
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
    };
    const id = mapFigmaNode(figmaNode, nodes, {});
    expect(nodes[id]!.type).toBe("text");
    expect((nodes[id] as any).content).toBe("Hello World");
  });

  it("maps RECTANGLE with image fill to image node", () => {
    const nodes: Record<string, CanvasNode> = {};
    const figmaNode: FigmaNode = {
      id: "r1",
      name: "Hero",
      type: "RECTANGLE",
      fills: [{ type: "IMAGE", imageRef: "img123" }],
      absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
    };
    const id = mapFigmaNode(figmaNode, nodes, {});
    expect(nodes[id]!.type).toBe("image");
    expect((nodes[id] as any).src).toBe("img123");
  });

  it("maps RECTANGLE without image to frame", () => {
    const nodes: Record<string, CanvasNode> = {};
    const figmaNode: FigmaNode = {
      id: "r2",
      name: "Box",
      type: "RECTANGLE",
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
    };
    const id = mapFigmaNode(figmaNode, nodes, {});
    expect(nodes[id]!.type).toBe("frame");
  });

  it("maps FRAME with children recursively", () => {
    const nodes: Record<string, CanvasNode> = {};
    const figmaNode: FigmaNode = {
      id: "f1",
      name: "Container",
      type: "FRAME",
      layoutMode: "VERTICAL",
      itemSpacing: 16,
      children: [
        { id: "t1", name: "Text", type: "TEXT", characters: "Hello" },
      ],
    };
    const id = mapFigmaNode(figmaNode, nodes, {});
    const frame = nodes[id] as any;
    expect(frame.type).toBe("frame");
    expect(frame.children).toHaveLength(1);
    expect(frame.layout.direction).toBe("column");
    expect(frame.layout.gap).toBe("16px");
  });

  it("maps INSTANCE to component node with componentRef", () => {
    const nodes: Record<string, CanvasNode> = {};
    const componentMap = { "comp-1": "Button" };
    const figmaNode: FigmaNode = {
      id: "i1",
      name: "My Button",
      type: "INSTANCE",
      componentId: "comp-1",
    };
    const id = mapFigmaNode(figmaNode, nodes, componentMap);
    const node = nodes[id] as any;
    expect(node.type).toBe("component");
    expect(node.componentRef).toBe("Button");
  });

  it("maps VECTOR types to vector nodes", () => {
    const nodes: Record<string, CanvasNode> = {};
    const types = ["VECTOR", "ELLIPSE", "LINE", "STAR", "REGULAR_POLYGON"];
    for (const type of types) {
      resetIdCounter();
      const n: Record<string, CanvasNode> = {};
      const id = mapFigmaNode(
        { id: "v1", name: "Shape", type, absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 } },
        n,
        {}
      );
      expect(n[id]!.type).toBe("vector");
    }
  });

  it("maps layout alignment properties", () => {
    const nodes: Record<string, CanvasNode> = {};
    const figmaNode: FigmaNode = {
      id: "f1",
      name: "Flex",
      type: "FRAME",
      layoutMode: "HORIZONTAL",
      primaryAxisAlignItems: "CENTER",
      counterAxisAlignItems: "STRETCH",
    };
    const id = mapFigmaNode(figmaNode, nodes, {});
    const frame = nodes[id] as any;
    expect(frame.layout.direction).toBe("row");
    expect(frame.layout.justify).toBe("center");
    expect(frame.layout.align).toBe("stretch");
  });

  it("maps styles: backgroundColor, dimensions, border", () => {
    const nodes: Record<string, CanvasNode> = {};
    const figmaNode: FigmaNode = {
      id: "f1",
      name: "Styled",
      type: "FRAME",
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
      absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 100 },
      cornerRadius: 8,
      strokes: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
      strokeWeight: 2,
    };
    const id = mapFigmaNode(figmaNode, nodes, {});
    const styles = nodes[id]!.styles as Record<string, unknown>;
    expect(styles.backgroundColor).toBe("#ff0000");
    expect(styles.width).toBe("200px");
    expect(styles.height).toBe("100px");
    expect(styles.borderRadius).toBe("8px");
    // Border is now mapped to the structured `stroke` property (not styles.border)
    const frame = nodes[id]!;
    expect((frame as any).stroke).toEqual({ color: "#000000", width: "2px", style: "solid" });
  });

  it("maps padding (uniform)", () => {
    const nodes: Record<string, CanvasNode> = {};
    const figmaNode: FigmaNode = {
      id: "f1",
      name: "Padded",
      type: "FRAME",
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 16,
      paddingBottom: 16,
    };
    const id = mapFigmaNode(figmaNode, nodes, {});
    const styles = nodes[id]!.styles as Record<string, unknown>;
    expect(styles.padding).toBe("16px");
  });

  it("generates unique IDs", () => {
    const nodes: Record<string, CanvasNode> = {};
    const id1 = mapFigmaNode({ id: "a", name: "A", type: "TEXT", characters: "a" }, nodes, {});
    const id2 = mapFigmaNode({ id: "b", name: "B", type: "TEXT", characters: "b" }, nodes, {});
    expect(id1).not.toBe(id2);
  });
});

// ============================================================
// mapFigmaComponents
// ============================================================
describe("mapFigmaComponents", () => {
  it("maps component definitions", () => {
    const comps = {
      "c1": { key: "k1", name: "Button", description: "A button" },
      "c2": { key: "k2", name: "Card", description: "" },
    };
    const result = mapFigmaComponents(comps);
    expect(result["Button"]).toBeDefined();
    expect(result["Button"]!.description).toBe("A button");
    expect(result["Card"]).toBeDefined();
    expect(result["Card"]!.description).toBeUndefined();
  });

  it("returns empty for no components", () => {
    expect(mapFigmaComponents({})).toEqual({});
  });
});

// ============================================================
// buildComponentMap
// ============================================================
describe("buildComponentMap", () => {
  it("maps component IDs to names", () => {
    const comps = {
      "c1": { key: "k1", name: "Button", description: "" },
      "c2": { key: "k2", name: "Card", description: "" },
    };
    const map = buildComponentMap(comps);
    expect(map["c1"]).toBe("Button");
    expect(map["c2"]).toBe("Card");
  });
});
