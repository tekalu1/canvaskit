import { describe, it, expect } from "vitest";
import { exportToSvg } from "../../src/export/svg.js";
import {
  createTestDocument,
  createDocumentWithNodes,
  createDocumentWithComponents,
} from "../helpers/create-test-document.js";

describe("exportToSvg", () => {
  it("exports a basic page as SVG", () => {
    const doc = createDocumentWithNodes();
    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("includes text content", () => {
    const doc = createDocumentWithNodes();
    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("Hello World");
  });

  it("renders text nodes with <text> elements", () => {
    const doc = createDocumentWithNodes();
    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<text");
    expect(result.svg).toContain("font-size=");
  });

  it("renders image nodes with <image> elements", () => {
    const doc = createDocumentWithNodes();
    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<image");
    expect(result.svg).toContain("href=");
    expect(result.svg).toContain("example.com/hero.png");
  });

  it("renders frames with background rect", () => {
    const doc = createDocumentWithNodes();
    const result = exportToSvg(doc, "page1");
    // Header has backgroundColor: #ffffff
    expect(result.svg).toContain("<rect");
    expect(result.svg).toContain("#ffffff");
  });

  it("exports a specific node subtree", () => {
    const doc = createDocumentWithNodes();
    const result = exportToSvg(doc, "page1", "content");
    expect(result.svg).toContain("Hello World");
    // Should not contain header background (since we start from content)
  });

  it("throws for unknown page", () => {
    const doc = createDocumentWithNodes();
    expect(() => exportToSvg(doc, "nonexistent")).toThrow("not found");
  });

  it("throws for unknown node", () => {
    const doc = createDocumentWithNodes();
    expect(() => exportToSvg(doc, "page1", "nonexistent")).toThrow("not found");
  });

  it("sets viewBox from page width", () => {
    const doc = createDocumentWithNodes();
    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("viewBox=");
    expect(result.svg).toContain(`width="${result.width}"`);
  });

  it("renders component nodes as rect placeholder", () => {
    const doc = createDocumentWithComponents();
    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("data-component=");
    expect(result.svg).toContain("Button");
  });

  it("renders vector nodes with path", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["icon"] = {
      type: "vector",
      name: "Arrow",
      path: "M10 10 L20 20",
      viewBox: "0 0 24 24",
      styles: { width: "24px", height: "24px" },
    };
    page.nodes["root"]!.children = ["icon"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<path");
    expect(result.svg).toContain("M10 10 L20 20");
  });

  it("renders icon nodes", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["star"] = {
      type: "icon",
      name: "Star",
      icon: "star",
      styles: { width: "24px", color: "#ffcc00" },
    };
    page.nodes["root"]!.children = ["star"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("data-icon=");
    expect(result.svg).toContain("star");
  });

  it("handles empty page with just root", () => {
    const doc = createTestDocument();
    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
  });

  it("escapes HTML in text content", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["xss"] = {
      type: "text",
      name: "XSS",
      content: '<script>alert("xss")</script>',
      styles: {},
    };
    page.nodes["root"]!.children = ["xss"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).not.toContain("<script>");
    expect(result.svg).toContain("&lt;script&gt;");
  });
});
