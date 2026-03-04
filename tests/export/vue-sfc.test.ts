import { describe, it, expect } from "vitest";
import { exportToVueSfc } from "../../src/export/vue-sfc.js";
import {
  createTestDocument,
  createDocumentWithNodes,
  createDocumentWithTokens,
  createDocumentWithComponents,
} from "../helpers/create-test-document.js";

describe("exportToVueSfc", () => {
  // -------------------------------------------------------
  // Basic structure
  // -------------------------------------------------------

  it("returns files array and entryComponent", () => {
    const doc = createDocumentWithNodes();
    const result = exportToVueSfc(doc, "page1");
    expect(result.files).toBeInstanceOf(Array);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.entryComponent).toMatch(/\.vue$/);
  });

  it("entry component filename is derived from page name", () => {
    const doc = createDocumentWithNodes();
    const result = exportToVueSfc(doc, "page1");
    expect(result.entryComponent).toBe("Page1.vue");
  });

  it("entry component contains <template> block", () => {
    const doc = createDocumentWithNodes();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<template>");
    expect(entry.content).toContain("</template>");
  });

  // -------------------------------------------------------
  // Frame rendering
  // -------------------------------------------------------

  it("renders frames as div with flex classes", () => {
    const doc = createDocumentWithNodes();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("flex flex-col");
    expect(entry.content).toContain("<div");
  });

  it("renders frame layout with gap", () => {
    const doc = createDocumentWithNodes();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("gap-[16px]");
  });

  // -------------------------------------------------------
  // Text rendering
  // -------------------------------------------------------

  it("renders text with semantic h1 tag for large text", () => {
    const doc = createDocumentWithNodes();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<h1");
    expect(entry.content).toContain("Hello World");
  });

  it("renders text with h2 tag for medium text", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["sub"] = {
      type: "text",
      name: "Sub",
      content: "Subtitle",
      styles: { fontSize: "24px" },
    };
    page.nodes["root"]!.children = ["sub"];

    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<h2");
    expect(entry.content).toContain("Subtitle");
  });

  it("renders text with p tag for small text", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["body"] = {
      type: "text",
      name: "Body",
      content: "Body text",
      styles: { fontSize: "14px" },
    };
    page.nodes["root"]!.children = ["body"];

    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<p");
    expect(entry.content).toContain("Body text");
  });

  // -------------------------------------------------------
  // Image rendering
  // -------------------------------------------------------

  it("renders image nodes with src and alt", () => {
    const doc = createDocumentWithNodes();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<img");
    expect(entry.content).toContain('src="https://example.com/hero.png"');
    expect(entry.content).toContain('alt="Hero banner"');
  });

  // -------------------------------------------------------
  // Icon rendering
  // -------------------------------------------------------

  it("renders icon nodes with data-icon", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["icon1"] = {
      type: "icon",
      name: "Icon",
      icon: "lucide:star",
      styles: {},
    };
    page.nodes["root"]!.children = ["icon1"];

    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain('data-icon="lucide:star"');
    expect(entry.content).toContain("<span");
  });

  // -------------------------------------------------------
  // Vector rendering
  // -------------------------------------------------------

  it("renders vector nodes as svg", () => {
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

    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<svg");
    expect(entry.content).toContain('viewBox="0 0 24 24"');
    expect(entry.content).toContain('<path d="M0 0 L10 10"');
  });

  // -------------------------------------------------------
  // Component rendering
  // -------------------------------------------------------

  it("renders component instances as PascalCase self-closing tags", () => {
    const doc = createDocumentWithComponents();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<Button");
    expect(entry.content).toContain("/>");
  });

  it("generates separate .vue file for component", () => {
    const doc = createDocumentWithComponents();
    const result = exportToVueSfc(doc, "page1");
    const compFile = result.files.find((f) => f.path === "Button.vue");
    expect(compFile).toBeDefined();
    expect(compFile!.content).toContain("<template>");
  });

  it("entry component imports child components", () => {
    const doc = createDocumentWithComponents();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain(
      "import Button from './Button.vue'"
    );
  });

  it("entry component has <script setup> when components are used", () => {
    const doc = createDocumentWithComponents();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<script setup");
  });

  it("component file renders template content", () => {
    const doc = createDocumentWithComponents();
    const result = exportToVueSfc(doc, "page1");
    const compFile = result.files.find((f) => f.path === "Button.vue")!;
    expect(compFile.content).toContain("Click me");
  });

  it("passes props on component instances", () => {
    const doc = createDocumentWithComponents();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain('label="Submit"');
  });

  // -------------------------------------------------------
  // Options
  // -------------------------------------------------------

  it("uses lang='ts' in script setup by default", () => {
    const doc = createDocumentWithComponents();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain('lang="ts"');
  });

  it("omits lang attribute when typescript is false", () => {
    const doc = createDocumentWithComponents();
    const result = exportToVueSfc(doc, "page1", undefined, {
      typescript: false,
    });
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).not.toContain('lang="ts"');
  });

  // -------------------------------------------------------
  // Tailwind class mapping
  // -------------------------------------------------------

  it("maps styles to Tailwind classes", () => {
    const doc = createDocumentWithNodes();
    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("bg-[#ffffff]");
    expect(entry.content).toContain("p-[24px]");
  });

  it("resolves token references", () => {
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

    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("bg-[#3b82f6]");
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

    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("&lt;script&gt;");
    expect(entry.content).not.toContain("<script>alert");
  });

  // -------------------------------------------------------
  // Subtree export
  // -------------------------------------------------------

  it("exports specific subtree with nodeId", () => {
    const doc = createDocumentWithNodes();
    const result = exportToVueSfc(doc, "page1", "content");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("Hello World");
    expect(entry.content).toContain("hero.png");
  });

  // -------------------------------------------------------
  // Error cases
  // -------------------------------------------------------

  it("throws for missing page", () => {
    const doc = createTestDocument();
    expect(() => exportToVueSfc(doc, "nonexistent")).toThrow(
      'Page "nonexistent" not found'
    );
  });

  it("throws for missing start node", () => {
    const doc = createTestDocument();
    expect(() => exportToVueSfc(doc, "page1", "missing")).toThrow(
      'Node "missing" not found on page "page1"'
    );
  });

  // -------------------------------------------------------
  // Missing node handling
  // -------------------------------------------------------

  it("renders comment for missing child node", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["root"]!.children = ["nonexistent"];

    const result = exportToVueSfc(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<!-- missing node: nonexistent -->");
  });
});
