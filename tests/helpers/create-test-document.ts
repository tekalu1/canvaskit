import { Document } from "../../src/core/document.js";
import type { CanvasDocument, Page, Tokens } from "../../src/core/schema.js";

/**
 * Create a minimal Document for testing, with deterministic timestamps.
 */
export function createTestDocument(
  name = "Test Document",
  width = 1440
): Document {
  return Document.create(name, width);
}

/**
 * Create a Document with pre-populated tokens.
 */
export function createDocumentWithTokens(tokens?: Partial<Tokens>): Document {
  const doc = createTestDocument();
  const data = doc.data;
  if (tokens) {
    Object.assign(data.tokens, tokens);
  }
  return doc;
}

/**
 * Create a Document with a richer node tree for testing.
 * Structure: root -> [header (frame), content (frame -> [title (text), image (image)])]
 */
export function createDocumentWithNodes(): Document {
  const doc = createTestDocument();
  const page = doc.data.pages["page1"]!;

  page.nodes["header"] = {
    type: "frame",
    name: "Header",
    layout: { direction: "row" },
    children: [],
    styles: { backgroundColor: "#ffffff" },
  };

  page.nodes["content"] = {
    type: "frame",
    name: "Content",
    layout: { direction: "column", gap: "16px" },
    children: ["title", "hero-image"],
    styles: { padding: "24px" },
  };

  page.nodes["title"] = {
    type: "text",
    name: "Title",
    content: "Hello World",
    styles: { fontSize: "32px", fontWeight: "bold" },
  };

  page.nodes["hero-image"] = {
    type: "image",
    name: "Hero Image",
    src: "https://example.com/hero.png",
    alt: "Hero banner",
    styles: { width: "100%", height: "400px" },
  };

  // Add header and content as children of root
  page.nodes["root"]!.children = ["header", "content"];

  return doc;
}

/**
 * Create a Document with pre-populated components and component instances.
 * Includes a "Button" component with template + a page with a component instance node.
 */
export function createDocumentWithComponents(): Document {
  const doc = createDocumentWithNodes();
  const page = doc.data.pages["page1"]!;

  // Define a Button component with a template
  doc.data.components["Button"] = {
    description: "A simple button component",
    variants: {
      primary: { backgroundColor: "#3b82f6", color: "#ffffff" },
      secondary: { backgroundColor: "#6b7280", color: "#ffffff" },
    },
    props: ["label", "variant"],
    defaultProps: { label: "Click me", variant: "primary" },
    template: {
      type: "frame",
      styles: {
        backgroundColor: "#3b82f6",
        padding: "12px",
        borderRadius: "8px",
      },
      children: [
        {
          type: "text",
          content: "Click me",
          styles: { color: "#ffffff", fontWeight: "semibold" },
        },
      ],
    },
  };

  // Add a component instance node
  page.nodes["btn-instance"] = {
    type: "component",
    name: "Primary Button",
    componentRef: "Button",
    props: { label: "Submit", variant: "primary" },
    overrides: {},
    styles: {},
  };

  // Add it as child of content frame
  page.nodes["content"]!.children.push("btn-instance");

  return doc;
}

/**
 * Build a raw CanvasDocument object (for schema validation testing).
 */
export function buildRawDocument(
  overrides?: Partial<CanvasDocument>
): CanvasDocument {
  const now = "2025-01-01T00:00:00.000Z";
  return {
    version: "1.0.0",
    meta: { name: "Raw Doc", created: now, modified: now },
    tokens: {
      colors: {},
      spacing: {},
      typography: {},
      borderRadius: {},
      shadows: {},
      breakpoints: {},
    },
    components: {},
    pages: {
      page1: {
        name: "Page 1",
        width: 1440,
        height: null,
        x: 0,
        y: 0,
        nodes: {
          root: {
            type: "frame",
            name: "Root",
            layout: { direction: "column" },
            children: [],
          },
        },
      },
    },
    ...overrides,
  };
}
