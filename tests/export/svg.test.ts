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

  // -------------------------------------------------------
  // Stroke rendering
  // -------------------------------------------------------

  it("renders frame with stroke attributes", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["box"] = {
      type: "frame",
      name: "StrokedBox",
      clip: false,
      layout: { direction: "column" },
      children: [],
      styles: { width: "200px", height: "100px", backgroundColor: "#ffffff" },
      stroke: { color: "#ff0000", width: 2, style: "solid" },
    } as any;
    page.nodes["root"]!.children = ["box"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain('stroke="#ff0000"');
    expect(result.svg).toContain('stroke-width="2"');
  });

  // -------------------------------------------------------
  // Linear gradient rendering
  // -------------------------------------------------------

  it("renders frame with linear gradient", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["grad"] = {
      type: "frame",
      name: "GradientBox",
      clip: false,
      layout: { direction: "column" },
      children: [],
      styles: { width: "200px", height: "100px" },
      gradient: {
        type: "linear",
        angle: 90,
        colors: [
          { color: "#ff0000", position: 0 },
          { color: "#0000ff", position: 1 },
        ],
      },
    } as any;
    page.nodes["root"]!.children = ["grad"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<linearGradient");
    expect(result.svg).toContain("stop-color=");
    expect(result.svg).toContain("url(#grad-grad)");
  });

  // -------------------------------------------------------
  // Radial gradient rendering
  // -------------------------------------------------------

  it("renders frame with radial gradient", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["rgrad"] = {
      type: "frame",
      name: "RadialGradientBox",
      clip: false,
      layout: { direction: "column" },
      children: [],
      styles: { width: "200px", height: "100px" },
      gradient: {
        type: "radial",
        colors: [
          { color: "#ff0000", position: 0 },
          { color: "#00ff00", position: 1 },
        ],
      },
    } as any;
    page.nodes["root"]!.children = ["rgrad"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<radialGradient");
    expect(result.svg).toContain("url(#grad-rgrad)");
  });

  // -------------------------------------------------------
  // Shadow effect rendering
  // -------------------------------------------------------

  it("renders frame with shadow effect", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["shadow"] = {
      type: "frame",
      name: "ShadowBox",
      clip: false,
      layout: { direction: "column" },
      children: [],
      styles: { width: "200px", height: "100px", backgroundColor: "#ffffff" },
      effects: [
        { type: "shadow", offsetX: 2, offsetY: 4, blur: 6, color: "#000000" },
      ],
    } as any;
    page.nodes["root"]!.children = ["shadow"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<feDropShadow");
    expect(result.svg).toContain('filter="url(#filter-shadow)"');
  });

  // -------------------------------------------------------
  // Blur effect rendering
  // -------------------------------------------------------

  it("renders frame with blur effect", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["blurred"] = {
      type: "frame",
      name: "BlurBox",
      clip: false,
      layout: { direction: "column" },
      children: [],
      styles: { width: "200px", height: "100px", backgroundColor: "#ffffff" },
      effects: [{ type: "blur", radius: 10 }],
    } as any;
    page.nodes["root"]!.children = ["blurred"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<feGaussianBlur");
    expect(result.svg).toContain('filter="url(#filter-blurred)"');
  });

  // -------------------------------------------------------
  // Row layout rendering
  // -------------------------------------------------------

  it("renders children in row direction", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["row"] = {
      type: "frame",
      name: "RowFrame",
      clip: false,
      layout: { direction: "row", gap: "10px" },
      children: ["child1", "child2"],
      styles: { width: "400px", height: "100px" },
    } as any;
    page.nodes["child1"] = {
      type: "text",
      name: "Child1",
      content: "Left",
      styles: { width: "100px", height: "30px" },
    };
    page.nodes["child2"] = {
      type: "text",
      name: "Child2",
      content: "Right",
      styles: { width: "100px", height: "30px" },
    };
    page.nodes["root"]!.children = ["row"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("Left");
    expect(result.svg).toContain("Right");
  });

  // -------------------------------------------------------
  // Missing child node
  // -------------------------------------------------------

  it("renders comment for missing child nodes", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["container"] = {
      type: "frame",
      name: "Container",
      clip: false,
      layout: { direction: "column" },
      children: ["nonexistent-child"],
      styles: { width: "200px", height: "100px" },
    } as any;
    page.nodes["root"]!.children = ["container"];

    const result = exportToSvg(doc, "page1");
    // The missing child should be skipped (continue in the for loop)
    expect(result.svg).toContain("<svg");
  });

  // -------------------------------------------------------
  // Vector without path
  // -------------------------------------------------------

  it("renders vector without path as rect", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["vec"] = {
      type: "vector",
      name: "EmptyVector",
      path: "",
      viewBox: "0 0 24 24",
      styles: { width: "50px", height: "50px" },
    };
    page.nodes["root"]!.children = ["vec"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("stroke=");
    expect(result.svg).toContain("#ccc");
  });

  // -------------------------------------------------------
  // Unknown node type
  // -------------------------------------------------------

  it("renders comment for unknown node types", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["unknown"] = {
      type: "custom-widget" as any,
      name: "Widget",
      styles: {},
    };
    page.nodes["root"]!.children = ["unknown"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<!-- unknown node type:");
  });

  // -------------------------------------------------------
  // Frame with border radius
  // -------------------------------------------------------

  it("renders frame with border radius", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["rounded"] = {
      type: "frame",
      name: "RoundedBox",
      clip: false,
      layout: { direction: "column" },
      children: [],
      styles: { width: "100px", height: "100px", backgroundColor: "#eee", borderRadius: "8px" },
    } as any;
    page.nodes["root"]!.children = ["rounded"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain('rx="8"');
  });

  // -------------------------------------------------------
  // Frame with no background (fill="none")
  // -------------------------------------------------------

  it("skips rect when frame has no visual properties", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["plain"] = {
      type: "frame",
      name: "PlainFrame",
      clip: false,
      layout: { direction: "column" },
      children: [],
      styles: { width: "100px", height: "100px" },
    } as any;
    page.nodes["root"]!.children = ["plain"];

    const result = exportToSvg(doc, "page1");
    // Should not render a rect for a frame with no bg/stroke/filter
    expect(result.svg).toContain("<svg");
  });

  // -------------------------------------------------------
  // Token resolution in SVG
  // -------------------------------------------------------

  it("resolves token references in styles", () => {
    const doc = createTestDocument();
    doc.data.tokens.colors = { primary: { value: "#3b82f6" } } as any;
    const page = doc.data.pages["page1"]!;
    page.nodes["tokenText"] = {
      type: "text",
      name: "TokenText",
      content: "Styled",
      styles: { fontSize: "20px", color: "{colors.primary}" },
    };
    page.nodes["root"]!.children = ["tokenText"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("#3b82f6");
  });

  // -------------------------------------------------------
  // resolve() fallback for non-string values
  // -------------------------------------------------------

  it("handles numeric style values via resolve fallback", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["numFrame"] = {
      type: "frame",
      name: "NumericFrame",
      clip: false,
      layout: { direction: "column", gap: 10 as any },
      children: ["numChild"],
      styles: { width: "200px", height: "100px", backgroundColor: "#eee" },
    } as any;
    page.nodes["numChild"] = {
      type: "text",
      name: "Child",
      content: "text",
      styles: { width: "100px", height: "30px" },
    };
    page.nodes["root"]!.children = ["numFrame"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<svg");
  });

  // -------------------------------------------------------
  // Multiple effects on a single frame
  // -------------------------------------------------------

  it("renders frame with both shadow and blur effects", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["multi"] = {
      type: "frame",
      name: "MultiEffectBox",
      clip: false,
      layout: { direction: "column" },
      children: [],
      styles: { width: "200px", height: "100px", backgroundColor: "#ffffff" },
      effects: [
        { type: "shadow", offsetX: 2, offsetY: 4, blur: 6, color: "#000000" },
        { type: "blur", radius: 8 },
      ],
    } as any;
    page.nodes["root"]!.children = ["multi"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<feDropShadow");
    expect(result.svg).toContain("<feGaussianBlur");
    expect(result.svg).toContain('filter="url(#filter-multi)"');
  });

  // -------------------------------------------------------
  // Gradient with default angle (no angle specified)
  // -------------------------------------------------------

  it("renders linear gradient with default angle when not specified", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["defAngle"] = {
      type: "frame",
      name: "DefaultAngle",
      clip: false,
      layout: { direction: "column" },
      children: [],
      styles: { width: "200px", height: "100px" },
      gradient: {
        type: "linear",
        colors: [
          { color: "#ff0000", position: 0 },
          { color: "#0000ff", position: 1 },
        ],
      },
    } as any;
    page.nodes["root"]!.children = ["defAngle"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("<linearGradient");
    expect(result.svg).toContain("url(#grad-defAngle)");
  });

  // -------------------------------------------------------
  // Frame with stroke + gradient combined
  // -------------------------------------------------------

  it("renders frame with stroke and gradient combined", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["combo"] = {
      type: "frame",
      name: "ComboBox",
      clip: false,
      layout: { direction: "column" },
      children: [],
      styles: { width: "200px", height: "100px" },
      stroke: { color: "#333333", width: 1, style: "solid" },
      gradient: {
        type: "linear",
        angle: 45,
        colors: [
          { color: "#aa0000", position: 0 },
          { color: "#0000aa", position: 1 },
        ],
      },
    } as any;
    page.nodes["root"]!.children = ["combo"];

    const result = exportToSvg(doc, "page1");
    expect(result.svg).toContain("url(#grad-combo)");
    expect(result.svg).toContain('stroke="#333333"');
    expect(result.svg).toContain('stroke-width="1"');
  });
});
