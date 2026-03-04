import { describe, it, expect } from "vitest";
import { exportToHtml } from "../../src/tools/export-tools.js";
import {
  createTestDocument,
  createDocumentWithNodes,
  createDocumentWithTokens,
} from "../helpers/create-test-document.js";

describe("exportToHtml", () => {
  // -------------------------------------------------------
  // HTML structure
  // -------------------------------------------------------

  it("generates valid HTML with DOCTYPE", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toMatch(/^<!DOCTYPE html>/);
  });

  it("includes <html> root element with lang attribute", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("</html>");
  });

  it("includes <head> with charset and viewport meta tags", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain('<meta charset="UTF-8" />');
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'
    );
  });

  it("includes Tailwind CDN script tag", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain(
      '<script src="https://cdn.tailwindcss.com"></script>'
    );
  });

  it("uses page name as <title>", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<title>Page 1</title>");
  });

  it("includes <body> element", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
  });

  // -------------------------------------------------------
  // Node rendering – frame
  // -------------------------------------------------------

  it("renders frame nodes as div with flex classes", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    // The root is a frame with direction column
    expect(html).toContain("flex flex-col");
    expect(html).toContain("<div");
  });

  // -------------------------------------------------------
  // Node rendering – text
  // -------------------------------------------------------

  it("renders text node as h1 when fontSize >= 32", () => {
    const doc = createDocumentWithNodes();
    // "title" node has fontSize: "32px" and fontWeight: "bold"
    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello World");
    expect(html).toContain("</h1>");
  });

  it("renders text node as h2 when fontSize >= 24 and < 32", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["subtitle"] = {
      type: "text",
      name: "Subtitle",
      content: "Sub heading",
      styles: { fontSize: "24px" },
    };
    page.nodes["root"]!.children = ["subtitle"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<h2");
    expect(html).toContain("Sub heading");
  });

  it("renders text node as h3 when fontSize >= 20 and < 24", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["subsubtitle"] = {
      type: "text",
      name: "SubSubtitle",
      content: "Section heading",
      styles: { fontSize: "20px" },
    };
    page.nodes["root"]!.children = ["subsubtitle"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<h3");
    expect(html).toContain("Section heading");
  });

  it("renders text node as p when fontSize < 20", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["paragraph"] = {
      type: "text",
      name: "Paragraph",
      content: "Body text",
      styles: { fontSize: "14px" },
    };
    page.nodes["root"]!.children = ["paragraph"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<p");
    expect(html).toContain("Body text");
    expect(html).toContain("</p>");
  });

  // -------------------------------------------------------
  // Node rendering – image
  // -------------------------------------------------------

  it("renders image node with src and alt attributes", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/hero.png"');
    expect(html).toContain('alt="Hero banner"');
    expect(html).toContain("/>");
  });

  // -------------------------------------------------------
  // Node rendering – icon
  // -------------------------------------------------------

  it("renders icon node with data-lucide attribute for Lucide CDN", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["menu-icon"] = {
      type: "icon",
      name: "Menu Icon",
      icon: "lucide:menu",
      styles: {},
    };
    page.nodes["root"]!.children = ["menu-icon"];

    const html = exportToHtml(doc, "page1");
    // Should use data-lucide attribute (not data-icon)
    expect(html).toContain('data-lucide="menu"');
    expect(html).toContain("<i");
    expect(html).toContain('aria-label="menu"');
    // Should NOT contain the old placeholder SVG
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<rect");
    expect(html).not.toContain("<circle");
    // Should NOT contain the lucide: prefix in the output
    expect(html).not.toContain("lucide:menu");
  });

  it("strips lucide: prefix from icon names", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["icon1"] = {
      type: "icon",
      name: "Arrow Icon",
      icon: "lucide:arrow-right",
      styles: {},
    };
    page.nodes["root"]!.children = ["icon1"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain('data-lucide="arrow-right"');
    expect(html).not.toContain("lucide:");
  });

  it("keeps icon name as-is when no lucide: prefix", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["icon1"] = {
      type: "icon",
      name: "Star Icon",
      icon: "star",
      styles: {},
    };
    page.nodes["root"]!.children = ["icon1"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain('data-lucide="star"');
  });

  it("includes Lucide CDN script when icons are present", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["icon1"] = {
      type: "icon",
      name: "Search",
      icon: "search",
      styles: {},
    };
    page.nodes["root"]!.children = ["icon1"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("unpkg.com/lucide@latest");
    expect(html).toContain("lucide.createIcons()");
  });

  it("omits Lucide CDN script when no icons are present", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).not.toContain("unpkg.com/lucide");
    expect(html).not.toContain("lucide.createIcons");
  });

  it("detects icons in nested frames", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["wrapper"] = {
      type: "frame",
      name: "Wrapper",
      layout: { direction: "column" },
      children: ["nested-icon"],
      styles: {},
    };
    page.nodes["nested-icon"] = {
      type: "icon",
      name: "Settings",
      icon: "lucide:settings",
      styles: {},
    };
    page.nodes["root"]!.children = ["wrapper"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("unpkg.com/lucide@latest");
    expect(html).toContain('data-lucide="settings"');
  });

  // -------------------------------------------------------
  // Node rendering – component
  // -------------------------------------------------------

  it("renders component node with data-component when no template", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["btn"] = {
      type: "component",
      name: "Button",
      componentRef: "Button",
      props: {},
      overrides: {},
      styles: {},
    };
    page.nodes["root"]!.children = ["btn"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain('data-component="Button"');
  });

  it("renders component template when available", () => {
    const doc = createTestDocument();
    doc.data.components["Card"] = {
      description: "A card",
      variants: {},
      props: [],
      defaultProps: {},
      template: {
        type: "frame",
        styles: { padding: "16px" },
        children: [
          { type: "text", content: "Card Title", styles: { fontSize: "20px" } },
        ],
      },
    };

    const page = doc.data.pages["page1"]!;
    page.nodes["card-inst"] = {
      type: "component",
      name: "Card Instance",
      componentRef: "Card",
      props: {},
      overrides: {},
      styles: {},
    };
    page.nodes["root"]!.children = ["card-inst"];

    const html = exportToHtml(doc, "page1");
    // Template renders as nested divs/p, not data-component
    expect(html).not.toContain("data-component");
    expect(html).toContain("Card Title");
  });

  // -------------------------------------------------------
  // Node rendering – vector
  // -------------------------------------------------------

  it("renders vector node as svg with path", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["arrow"] = {
      type: "vector",
      name: "Arrow",
      path: "M0 0 L10 10",
      viewBox: "0 0 24 24",
      styles: {},
    };
    page.nodes["root"]!.children = ["arrow"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<svg");
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('<path d="M0 0 L10 10" />');
  });

  // -------------------------------------------------------
  // Missing node handling
  // -------------------------------------------------------

  it("renders a comment for missing child node", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["root"]!.children = ["nonexistent"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<!-- missing node: nonexistent -->");
  });

  // -------------------------------------------------------
  // Style mapping
  // -------------------------------------------------------

  it("maps backgroundColor to bg-[value]", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain("bg-[#ffffff]");
  });

  it("maps color to text-[value]", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["colored"] = {
      type: "text",
      name: "Colored",
      content: "red text",
      styles: { color: "#ff0000" },
    };
    page.nodes["root"]!.children = ["colored"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("text-[#ff0000]");
  });

  it("maps padding to p-[value]", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain("p-[24px]");
  });

  it("maps paddingX to px-[value] and paddingY to py-[value]", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["padded"] = {
      type: "frame",
      name: "Padded",
      layout: { direction: "column" },
      children: [],
      styles: { paddingX: "8px", paddingY: "16px" },
    };
    page.nodes["root"]!.children = ["padded"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("px-[8px]");
    expect(html).toContain("py-[16px]");
  });

  it("maps width to w-[value] and height to h-[value]", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain("w-[100%]");
    expect(html).toContain("h-[400px]");
  });

  it("maps fontSize to text-[value]", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain("text-[32px]");
  });

  it("maps fontWeight bold to font-bold", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain("font-bold");
  });

  it("maps fontWeight semibold/medium/light correctly", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;

    page.nodes["semi"] = {
      type: "text",
      name: "Semi",
      content: "A",
      styles: { fontWeight: "semibold" },
    };
    page.nodes["med"] = {
      type: "text",
      name: "Med",
      content: "B",
      styles: { fontWeight: "medium" },
    };
    page.nodes["lt"] = {
      type: "text",
      name: "Lt",
      content: "C",
      styles: { fontWeight: "light" },
    };
    page.nodes["root"]!.children = ["semi", "med", "lt"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("font-semibold");
    expect(html).toContain("font-medium");
    expect(html).toContain("font-light");
  });

  it("maps borderRadius to rounded-[value]", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["rounded"] = {
      type: "frame",
      name: "Rounded",
      layout: { direction: "column" },
      children: [],
      styles: { borderRadius: "8px" },
    };
    page.nodes["root"]!.children = ["rounded"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("rounded-[8px]");
  });

  it("maps overflow to overflow-{value}", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["of"] = {
      type: "frame",
      name: "Overflow",
      layout: { direction: "column" },
      children: [],
      styles: { overflow: "hidden" },
    };
    page.nodes["root"]!.children = ["of"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("overflow-hidden");
  });

  // -------------------------------------------------------
  // Layout mapping
  // -------------------------------------------------------

  it("maps direction row to flex-row", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    // header has direction: "row"
    expect(html).toContain("flex-row");
  });

  it("maps direction column to flex-col", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    expect(html).toContain("flex-col");
  });

  it("maps gap to gap-[value]", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1");
    // content has gap: "16px"
    expect(html).toContain("gap-[16px]");
  });

  it("maps align to items-start/center/end/stretch", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;

    page.nodes["a1"] = {
      type: "frame",
      name: "A1",
      layout: { direction: "row", align: "center" },
      children: [],
    };
    page.nodes["a2"] = {
      type: "frame",
      name: "A2",
      layout: { direction: "row", align: "stretch" },
      children: [],
    };
    page.nodes["root"]!.children = ["a1", "a2"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("items-center");
    expect(html).toContain("items-stretch");
  });

  it("maps justify to justify-start/center/end/between/around/evenly", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;

    page.nodes["j1"] = {
      type: "frame",
      name: "J1",
      layout: { direction: "row", justify: "between" },
      children: [],
    };
    page.nodes["j2"] = {
      type: "frame",
      name: "J2",
      layout: { direction: "row", justify: "evenly" },
      children: [],
    };
    page.nodes["root"]!.children = ["j1", "j2"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("justify-between");
    expect(html).toContain("justify-evenly");
  });

  it("maps wrap to flex-wrap", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["wrapped"] = {
      type: "frame",
      name: "Wrapped",
      layout: { direction: "row", wrap: true },
      children: [],
    };
    page.nodes["root"]!.children = ["wrapped"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("flex-wrap");
  });

  // -------------------------------------------------------
  // Token reference resolution
  // -------------------------------------------------------

  it("resolves token references in styles", () => {
    const doc = createDocumentWithTokens({
      colors: { primary: { value: "#3b82f6" } },
    });
    const page = doc.data.pages["page1"]!;
    page.nodes["box"] = {
      type: "frame",
      name: "Box",
      layout: { direction: "column" },
      children: [],
      styles: { backgroundColor: "{colors.primary}" },
    };
    page.nodes["root"]!.children = ["box"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("bg-[#3b82f6]");
    expect(html).not.toContain("{colors.primary}");
  });

  // -------------------------------------------------------
  // HTML escaping
  // -------------------------------------------------------

  it("escapes HTML entities in text content", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["xss"] = {
      type: "text",
      name: "XSS",
      content: '<script>alert("xss")</script>',
      styles: {},
    };
    page.nodes["root"]!.children = ["xss"];

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;xss&quot;");
    expect(html).not.toContain("<script>alert");
  });

  // -------------------------------------------------------
  // Error cases
  // -------------------------------------------------------

  it("throws for missing page", () => {
    const doc = createTestDocument();
    expect(() => exportToHtml(doc, "nonexistent")).toThrow(
      'Page "nonexistent" not found'
    );
  });

  it("throws for missing start node when nodeId is specified", () => {
    const doc = createTestDocument();
    expect(() => exportToHtml(doc, "page1", "missing-node")).toThrow(
      'Node "missing-node" not found on page "page1"'
    );
  });

  // -------------------------------------------------------
  // Subtree export
  // -------------------------------------------------------

  it("exports specific subtree with nodeId parameter", () => {
    const doc = createDocumentWithNodes();
    const html = exportToHtml(doc, "page1", "content");
    // Should contain only the content frame and its children, not header
    expect(html).toContain("Hello World");
    expect(html).toContain("hero.png");
    // The output is still a full HTML doc with DOCTYPE
    expect(html).toContain("<!DOCTYPE html>");
  });

  // -------------------------------------------------------
  // CSS Custom Properties
  // -------------------------------------------------------

  it("includes CSS custom properties in <style> block when tokens exist", () => {
    const doc = createDocumentWithTokens({
      colors: { primary: { value: "#6366F1" } },
      spacing: { md: { value: "16px" } },
    });
    const page = doc.data.pages["page1"]!;
    page.nodes["root"] = {
      type: "frame",
      name: "Root",
      layout: { direction: "column" },
      children: [],
    };

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<style>");
    expect(html).toContain("--colors-primary: #6366F1;");
    expect(html).toContain("--spacing-md: 16px;");
    expect(html).toContain(":root {");
  });

  it("omits <style> block when no tokens are defined", () => {
    const doc = createTestDocument();
    const html = exportToHtml(doc, "page1");
    expect(html).not.toContain("<style>");
  });

  it("includes typography CSS custom properties with sub-properties", () => {
    const doc = createDocumentWithTokens({
      typography: {
        heading: {
          fontFamily: "Inter",
          fontSize: "32px",
          fontWeight: "bold",
          lineHeight: "1.2",
        },
      },
    });
    const page = doc.data.pages["page1"]!;
    page.nodes["root"] = {
      type: "frame",
      name: "Root",
      layout: { direction: "column" },
      children: [],
    };

    const html = exportToHtml(doc, "page1");
    expect(html).toContain("<style>");
    expect(html).toContain("--typography-heading-font-family: Inter;");
    expect(html).toContain("--typography-heading-font-size: 32px;");
  });
});
