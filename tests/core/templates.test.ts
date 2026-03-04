import { describe, it, expect, beforeEach } from "vitest";

// Dynamic import to ensure registration happens
let getTemplate: (name: string) => any;
let listTemplates: () => Array<{ name: string; description: string }>;

beforeEach(async () => {
  const mod = await import("../../src/templates/index.js");
  getTemplate = mod.getTemplate;
  listTemplates = mod.listTemplates;
});

describe("Template Registry", () => {
  it("lists available templates", () => {
    const templates = listTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.some((t) => t.name === "landing")).toBe(true);
  });

  it("returns undefined for unknown template", () => {
    const template = getTemplate("nonexistent");
    expect(template).toBeUndefined();
  });
});

describe("Landing Page Template", () => {
  it("builds a valid landing page document", () => {
    const template = getTemplate("landing");
    expect(template).toBeDefined();

    const doc = template!.build();
    expect(doc.version).toBe("1.0.0");
    expect(doc.meta.name).toBe("Landing Page");
    expect(doc.meta.created).toBeDefined();
    expect(doc.meta.modified).toBeDefined();
  });

  it("has design tokens for colors, spacing, typography", () => {
    const doc = getTemplate("landing")!.build();
    expect(Object.keys(doc.tokens.colors).length).toBeGreaterThan(0);
    expect(doc.tokens.colors.primary).toBeDefined();
    expect(doc.tokens.colors.primary.value).toBe("#6366F1");
    expect(Object.keys(doc.tokens.spacing).length).toBeGreaterThan(0);
    expect(Object.keys(doc.tokens.typography).length).toBeGreaterThan(0);
    expect(Object.keys(doc.tokens.borderRadius).length).toBeGreaterThan(0);
  });

  it("has shadows token as empty object", () => {
    const doc = getTemplate("landing")!.build();
    expect(doc.tokens.shadows).toEqual({});
  });

  it("has only pill in borderRadius", () => {
    const doc = getTemplate("landing")!.build();
    const keys = Object.keys(doc.tokens.borderRadius);
    expect(keys).toEqual(["pill"]);
    expect(doc.tokens.borderRadius.pill.value).toBe("9999px");
  });

  it("has page with root node and sections", () => {
    const doc = getTemplate("landing")!.build();
    const page = doc.pages.page1;
    expect(page).toBeDefined();
    expect(page.name).toBe("Landing Page");
    expect(page.nodes.root).toBeDefined();
    expect(page.nodes.root.type).toBe("frame");
  });

  it("has navbar, hero, stats, features, and CTA sections", () => {
    const doc = getTemplate("landing")!.build();
    const root = doc.pages.page1.nodes.root;
    expect(root.type).toBe("frame");
    if (root.type === "frame") {
      expect(root.children).toEqual(["navbar", "hero", "stats", "features", "cta"]);
    }
  });

  it("has stats section with 3 stats", () => {
    const doc = getTemplate("landing")!.build();
    const nodes = doc.pages.page1.nodes;
    expect(nodes["stats"]).toBeDefined();
    expect(nodes["stat-1"]).toBeDefined();
    expect(nodes["stat-2"]).toBeDefined();
    expect(nodes["stat-3"]).toBeDefined();
  });

  it("has hero-badge node", () => {
    const doc = getTemplate("landing")!.build();
    const nodes = doc.pages.page1.nodes;
    expect(nodes["hero-badge"]).toBeDefined();
    expect(nodes["hero-badge"].type).toBe("text");
    if (nodes["hero-badge"].type === "text") {
      expect(nodes["hero-badge"].content).toBe("Now in Beta");
    }
  });

  it("has 3 feature cards with icons", () => {
    const doc = getTemplate("landing")!.build();
    const nodes = doc.pages.page1.nodes;
    expect(nodes["feature-1"]).toBeDefined();
    expect(nodes["feature-2"]).toBeDefined();
    expect(nodes["feature-3"]).toBeDefined();

    // Each card has an icon
    expect(nodes["feature-1-icon"]).toBeDefined();
    expect(nodes["feature-1-icon"].type).toBe("icon");
    expect(nodes["feature-2-icon"]).toBeDefined();
    expect(nodes["feature-3-icon"]).toBeDefined();
  });

  it("uses token references in styles", () => {
    const doc = getTemplate("landing")!.build();
    const nodes = doc.pages.page1.nodes;

    // Check that some nodes reference tokens
    const heroTitle = nodes["hero-title"];
    expect(heroTitle.styles?.color).toBe("{colors.secondary}");

    // CTA subtitle should use a light color readable on dark background
    const ctaSubtitle = nodes["cta-subtitle"];
    expect(ctaSubtitle.styles?.color).toBe("{colors.text-light}");
  });

  it("validates against the CanvasDocumentSchema", async () => {
    const { CanvasDocumentSchema } = await import("../../src/core/schema.js");
    const doc = getTemplate("landing")!.build();
    const result = CanvasDocumentSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it("has description", () => {
    const template = getTemplate("landing");
    expect(template!.description).toBeTruthy();
    expect(template!.description.length).toBeGreaterThan(0);
  });
});
