import { describe, it, expect, vi, beforeEach } from "vitest";
import { convertFigmaFile, type FigmaImportOptions } from "../../src/import/figma.js";
import type { FigmaFile } from "../../src/import/figma-mapper.js";

/**
 * Build a minimal FigmaFile for testing (no API calls needed).
 */
function buildTestFigmaFile(overrides?: Partial<FigmaFile>): FigmaFile {
  return {
    name: "Test Design",
    document: {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [
        {
          id: "1:1",
          name: "Page 1",
          type: "CANVAS",
          absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
          children: [
            {
              id: "2:1",
              name: "Header",
              type: "FRAME",
              layoutMode: "HORIZONTAL",
              itemSpacing: 16,
              absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 80 },
              fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
              children: [
                {
                  id: "3:1",
                  name: "Logo",
                  type: "TEXT",
                  characters: "MyApp",
                  style: { fontSize: 24, fontWeight: 700 },
                  fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
                },
              ],
            },
            {
              id: "2:2",
              name: "Hero Image",
              type: "RECTANGLE",
              absoluteBoundingBox: { x: 0, y: 80, width: 1440, height: 400 },
              fills: [{ type: "IMAGE", imageRef: "hero-img-ref" }],
            },
          ],
        },
      ],
    },
    components: {
      "comp-1": { key: "btn-key", name: "Button", description: "Primary button" },
    },
    ...overrides,
  };
}

describe("convertFigmaFile", () => {
  it("converts a basic Figma file to Document", () => {
    const figmaFile = buildTestFigmaFile();
    const result = convertFigmaFile(figmaFile);

    expect(result.pages).toBe(1);
    expect(result.nodes).toBeGreaterThan(0);
    expect(result.document).toBeDefined();
  });

  it("preserves the file name", () => {
    const figmaFile = buildTestFigmaFile({ name: "My Cool Design" });
    const result = convertFigmaFile(figmaFile);
    expect(result.document.data.meta.name).toBe("My Cool Design");
  });

  it("creates a page for each Figma canvas", () => {
    const figmaFile = buildTestFigmaFile();
    figmaFile.document.children!.push({
      id: "1:2",
      name: "Page 2",
      type: "CANVAS",
      children: [],
    });
    const result = convertFigmaFile(figmaFile);
    expect(result.pages).toBe(2);
    expect(result.document.data.pages["page1"]).toBeDefined();
    expect(result.document.data.pages["page2"]).toBeDefined();
  });

  it("maps page names from Figma canvases", () => {
    const figmaFile = buildTestFigmaFile();
    const result = convertFigmaFile(figmaFile);
    expect(result.document.data.pages["page1"]!.name).toBe("Page 1");
  });

  it("creates root frame with column layout", () => {
    const figmaFile = buildTestFigmaFile();
    const result = convertFigmaFile(figmaFile);
    const page = result.document.data.pages["page1"]!;
    expect(page.nodes["root"]).toBeDefined();
    expect(page.nodes["root"]!.type).toBe("frame");
    expect((page.nodes["root"] as any).layout.direction).toBe("column");
  });

  it("maps child nodes into the page", () => {
    const figmaFile = buildTestFigmaFile();
    const result = convertFigmaFile(figmaFile);
    const page = result.document.data.pages["page1"]!;
    const root = page.nodes["root"] as any;
    // root should have 2 children (Header frame and Hero Image)
    expect(root.children.length).toBe(2);
  });

  it("extracts tokens when enabled", () => {
    const figmaFile = buildTestFigmaFile();
    const result = convertFigmaFile(figmaFile, { extractTokens: true });
    expect(result.tokens).toBeGreaterThan(0);
  });

  it("skips token extraction when disabled", () => {
    const figmaFile = buildTestFigmaFile();
    const result = convertFigmaFile(figmaFile, { extractTokens: false });
    expect(result.tokens).toBe(0);
  });

  it("maps components when enabled", () => {
    const figmaFile = buildTestFigmaFile();
    const result = convertFigmaFile(figmaFile, { importComponents: true });
    expect(result.components).toBe(1);
    expect(result.document.data.components["Button"]).toBeDefined();
  });

  it("skips components when disabled", () => {
    const figmaFile = buildTestFigmaFile();
    const result = convertFigmaFile(figmaFile, { importComponents: false });
    expect(result.components).toBe(0);
  });

  it("handles a file with no children gracefully", () => {
    const figmaFile = buildTestFigmaFile();
    figmaFile.document.children = [];
    const result = convertFigmaFile(figmaFile);
    expect(result.pages).toBe(0);
    expect(result.nodes).toBe(0);
  });

  it("handles a page with no children", () => {
    const figmaFile = buildTestFigmaFile();
    figmaFile.document.children = [
      { id: "1:1", name: "Empty Page", type: "CANVAS" },
    ];
    const result = convertFigmaFile(figmaFile);
    expect(result.pages).toBe(1);
    const page = result.document.data.pages["page1"]!;
    // Only root node
    expect(Object.keys(page.nodes)).toEqual(["root"]);
  });

  it("produces valid JSON output", () => {
    const figmaFile = buildTestFigmaFile();
    const result = convertFigmaFile(figmaFile);
    const json = result.document.toJSON(true);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
