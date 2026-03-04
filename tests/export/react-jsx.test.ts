import { describe, it, expect } from "vitest";
import { exportToReactJsx } from "../../src/export/react-jsx.js";
import {
  createTestDocument,
  createDocumentWithNodes,
  createDocumentWithTokens,
  createDocumentWithComponents,
} from "../helpers/create-test-document.js";

describe("exportToReactJsx", () => {
  // -------------------------------------------------------
  // Basic structure
  // -------------------------------------------------------

  it("returns files array and entryComponent", () => {
    const doc = createDocumentWithNodes();
    const result = exportToReactJsx(doc, "page1");
    expect(result.files).toBeInstanceOf(Array);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.entryComponent).toMatch(/\.tsx$/);
  });

  it("entry component uses .jsx extension when typescript is false", () => {
    const doc = createDocumentWithNodes();
    const result = exportToReactJsx(doc, "page1", undefined, {
      typescript: false,
    });
    expect(result.entryComponent).toMatch(/\.jsx$/);
  });

  it("entry component is a function component", () => {
    const doc = createDocumentWithNodes();
    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("export default function Page1()");
  });

  it("entry component has return statement with JSX", () => {
    const doc = createDocumentWithNodes();
    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("return (");
    expect(entry.content).toContain("<div");
  });

  // -------------------------------------------------------
  // className instead of class
  // -------------------------------------------------------

  it("uses className instead of class", () => {
    const doc = createDocumentWithNodes();
    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("className=");
    expect(entry.content).not.toMatch(/ class="/);
  });

  // -------------------------------------------------------
  // Frame rendering
  // -------------------------------------------------------

  it("renders frames as div with flex classes", () => {
    const doc = createDocumentWithNodes();
    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("flex flex-col");
  });

  // -------------------------------------------------------
  // Text rendering
  // -------------------------------------------------------

  it("renders text with semantic h1 tag", () => {
    const doc = createDocumentWithNodes();
    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<h1");
    expect(entry.content).toContain("Hello World");
  });

  it("renders p tag for small text", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["body"] = {
      type: "text",
      name: "Body",
      content: "Body text",
      styles: { fontSize: "14px" },
    };
    page.nodes["root"]!.children = ["body"];

    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<p");
  });

  // -------------------------------------------------------
  // Image rendering
  // -------------------------------------------------------

  it("renders image nodes with src and alt", () => {
    const doc = createDocumentWithNodes();
    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<img");
    expect(entry.content).toContain('src="https://example.com/hero.png"');
    expect(entry.content).toContain('alt="Hero banner"');
  });

  // -------------------------------------------------------
  // Component rendering
  // -------------------------------------------------------

  it("renders component instances as PascalCase tags", () => {
    const doc = createDocumentWithComponents();
    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("<Button");
  });

  it("generates separate .tsx file for component", () => {
    const doc = createDocumentWithComponents();
    const result = exportToReactJsx(doc, "page1");
    const compFile = result.files.find((f) => f.path === "Button.tsx");
    expect(compFile).toBeDefined();
    expect(compFile!.content).toContain("export default function Button");
  });

  it("generates .jsx file for component when typescript is false", () => {
    const doc = createDocumentWithComponents();
    const result = exportToReactJsx(doc, "page1", undefined, {
      typescript: false,
    });
    const compFile = result.files.find((f) => f.path === "Button.jsx");
    expect(compFile).toBeDefined();
  });

  it("entry component imports child components", () => {
    const doc = createDocumentWithComponents();
    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("import Button from './Button'");
  });

  it("component file uses className", () => {
    const doc = createDocumentWithComponents();
    const result = exportToReactJsx(doc, "page1");
    const compFile = result.files.find((f) => f.path === "Button.tsx")!;
    expect(compFile.content).toContain("className=");
  });

  it("passes props on component instances", () => {
    const doc = createDocumentWithComponents();
    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain('label="Submit"');
  });

  // -------------------------------------------------------
  // JSX escaping
  // -------------------------------------------------------

  it("escapes HTML entities and JSX curly braces in text", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["special"] = {
      type: "text",
      name: "Special",
      content: 'a < b & {x}',
      styles: {},
    };
    page.nodes["root"]!.children = ["special"];

    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("&lt;");
    expect(entry.content).toContain("&amp;");
    expect(entry.content).toContain("&#123;");
    expect(entry.content).toContain("&#125;");
  });

  // -------------------------------------------------------
  // Missing node handling
  // -------------------------------------------------------

  it("renders JSX comment for missing child node", () => {
    const doc = createTestDocument();
    const page = doc.data.pages["page1"]!;
    page.nodes["root"]!.children = ["nonexistent"];

    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("{/* missing node: nonexistent */}");
  });

  // -------------------------------------------------------
  // Token resolution
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

    const result = exportToReactJsx(doc, "page1");
    const entry = result.files.find(
      (f) => f.path === result.entryComponent
    )!;
    expect(entry.content).toContain("bg-[#3b82f6]");
  });

  // -------------------------------------------------------
  // Error cases
  // -------------------------------------------------------

  it("throws for missing page", () => {
    const doc = createTestDocument();
    expect(() => exportToReactJsx(doc, "nonexistent")).toThrow(
      'Page "nonexistent" not found'
    );
  });

  it("throws for missing start node", () => {
    const doc = createTestDocument();
    expect(() => exportToReactJsx(doc, "page1", "missing")).toThrow(
      'Node "missing" not found on page "page1"'
    );
  });
});
