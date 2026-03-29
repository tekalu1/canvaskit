import { describe, it, expect, beforeEach } from "vitest";
import type { Page } from "../../src/core/schema.js";
import type { Template } from "../../src/templates/index.js";

// Dynamic import to ensure registration happens
let getTemplate: (name: string) => Template | undefined;
let listTemplates: () => Array<{ name: string; description: string }>;

beforeEach(async () => {
  const mod = await import("../../src/templates/index.js");
  getTemplate = mod.getTemplate;
  listTemplates = mod.listTemplates;
});

// ── Helper: validate all children references in a page ───────
function validateChildrenRefs(page: Page): void {
  const nodeIds = new Set(Object.keys(page.nodes));
  for (const [id, node] of Object.entries(page.nodes)) {
    if (node.type === "frame" && node.children) {
      for (const childId of node.children) {
        expect(
          nodeIds.has(childId),
          `Node "${id}" references child "${childId}" but it does not exist in page nodes`,
        ).toBe(true);
      }
    }
  }
}

describe("Template Registry", () => {
  it("lists available templates", () => {
    const templates = listTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.some((t) => t.name === "landing")).toBe(true);
  });

  // TC-001: design-system and presentation are listed
  it("lists design-system and presentation templates", () => {
    const templates = listTemplates();
    expect(templates.some((t) => t.name === "design-system")).toBe(true);
    expect(templates.some((t) => t.name === "presentation")).toBe(true);
  });

  // TC-002: Unknown template returns undefined
  it("returns undefined for unknown template", () => {
    const template = getTemplate("nonexistent");
    expect(template).toBeUndefined();
  });

  // TC-003: Template name set matches exactly
  it("has exactly the expected set of template names", () => {
    const templates = listTemplates();
    const names = new Set(templates.map((t) => t.name));
    expect(names).toEqual(new Set(["landing", "design-system", "presentation"]));
  });

  // TC-042: All templates have non-empty descriptions
  it("all templates have non-empty descriptions", () => {
    const templates = listTemplates();
    for (const t of templates) {
      expect(t.description.length).toBeGreaterThan(0);
    }
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

// ── Design System Template ───────────────────────────────────
describe("Design System Template", () => {
  // TC-004: Document generation
  it("generates a document with correct version and meta", () => {
    const template = getTemplate("design-system");
    expect(template).toBeDefined();

    const doc = template!.build();
    expect(doc.version).toBe("1.0.0");
    expect(doc.meta.name).toBe("Design System");
    expect(doc.meta.created).toBeDefined();
    expect(doc.meta.modified).toBeDefined();
    // ISO date-time format
    expect(() => new Date(doc.meta.created).toISOString()).not.toThrow();
    expect(() => new Date(doc.meta.modified).toISOString()).not.toThrow();
  });

  // TC-005: Schema validation
  it("validates against CanvasDocumentSchema", async () => {
    const { CanvasDocumentSchema } = await import("../../src/core/schema.js");
    const doc = getTemplate("design-system")!.build();
    const result = CanvasDocumentSchema.safeParse(doc);
    if (!result.success) {
      console.error("Validation errors:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  // TC-006: 10-page structure
  it("has 10 pages, each with a name and root node", () => {
    const doc = getTemplate("design-system")!.build();
    const pageKeys = Object.keys(doc.pages);
    expect(pageKeys.length).toBe(10);

    for (const key of pageKeys) {
      const page = doc.pages[key];
      expect(page.name).toBeTruthy();
      expect(page.nodes.root).toBeDefined();
      expect(page.nodes.root.type).toBe("frame");
    }
  });

  // TC-007: No 11th page
  it("does not have an 11th page", () => {
    const doc = getTemplate("design-system")!.build();
    expect(doc.pages.page11).toBeUndefined();
  });

  // TC-039: All pages 1440px width, null height
  it("has all pages with width 1440 and height null", () => {
    const doc = getTemplate("design-system")!.build();
    for (const key of Object.keys(doc.pages)) {
      expect(doc.pages[key].width).toBe(1440);
      expect(doc.pages[key].height).toBeNull();
    }
  });

  // TC-040: Page order
  it("has pages in the correct order", () => {
    const doc = getTemplate("design-system")!.build();
    const expectedNames = [
      "Color Palette",
      "Typography",
      "Spacing & Sizing",
      "Border Radius & Shadows",
      "Icons",
      "Buttons",
      "Form Elements",
      "Cards",
      "Navigation",
      "Feedback",
    ];
    const actualNames = Array.from({ length: 10 }, (_, i) => doc.pages[`page${i + 1}`].name);
    expect(actualNames).toEqual(expectedNames);
  });

  // TC-008: Design tokens
  it("has design tokens with semantic colors, spacing, and typography", () => {
    const doc = getTemplate("design-system")!.build();
    const { colors, spacing, typography } = doc.tokens;

    // Semantic colors
    expect(colors.success).toBeDefined();
    expect(colors.warning).toBeDefined();
    expect(colors.error).toBeDefined();
    expect(colors.info).toBeDefined();

    // Spacing & typography are non-empty
    expect(Object.keys(spacing).length).toBeGreaterThan(0);
    expect(Object.keys(typography).length).toBeGreaterThan(0);
  });

  // TC-009: Children reference integrity
  it("has valid children references in all pages", () => {
    const doc = getTemplate("design-system")!.build();
    for (const key of Object.keys(doc.pages)) {
      validateChildrenRefs(doc.pages[key]);
    }
  });

  // TC-010: Color Palette page
  it("page1 (Color Palette) has swatch frames and label texts", () => {
    const doc = getTemplate("design-system")!.build();
    const nodes = doc.pages.page1.nodes;

    // Has brand swatch
    expect(nodes["cp-swatch-primary"]).toBeDefined();
    expect(nodes["cp-swatch-primary"].type).toBe("frame");
    expect(nodes["cp-label-primary"]).toBeDefined();

    // Has semantic swatches
    expect(nodes["cp-swatch-success"]).toBeDefined();
    expect(nodes["cp-swatch-warning"]).toBeDefined();
    expect(nodes["cp-swatch-error"]).toBeDefined();
    expect(nodes["cp-swatch-info"]).toBeDefined();

    // Has neutral swatches
    expect(nodes["cp-swatch-neutral-50"]).toBeDefined();
    expect(nodes["cp-swatch-neutral-900"]).toBeDefined();
  });

  // TC-011: Typography page
  it("page2 (Typography) has text nodes with different font sizes", () => {
    const doc = getTemplate("design-system")!.build();
    const nodes = doc.pages.page2.nodes;

    // Has text samples for various type scales
    expect(nodes["ty-sample-h1"]).toBeDefined();
    expect(nodes["ty-sample-h1"].type).toBe("text");
    expect(nodes["ty-sample-body"]).toBeDefined();
    expect(nodes["ty-sample-caption"]).toBeDefined();

    // Different font sizes
    const h1Styles = nodes["ty-sample-h1"].styles as Record<string, unknown>;
    const bodyStyles = nodes["ty-sample-body"].styles as Record<string, unknown>;
    expect(h1Styles.fontSize).not.toBe(bodyStyles.fontSize);
  });

  // TC-012: Spacing page
  it("page3 (Spacing & Sizing) has spacing visualization frames", () => {
    const doc = getTemplate("design-system")!.build();
    const nodes = doc.pages.page3.nodes;

    // Has spacing bars
    expect(nodes["sp-bar-sm"]).toBeDefined();
    expect(nodes["sp-bar-sm"].type).toBe("frame");
    expect(nodes["sp-bar-lg"]).toBeDefined();
    expect(nodes["sp-label-sm"]).toBeDefined();
  });

  // TC-013: Border Radius & Shadows page
  it("page4 (Border Radius & Shadows) has radius and shadow frames", () => {
    const doc = getTemplate("design-system")!.build();
    const nodes = doc.pages.page4.nodes;

    // Radius frames
    expect(nodes["br-radius-none"]).toBeDefined();
    expect(nodes["br-radius-full"]).toBeDefined();

    // Shadow frames with effects
    expect(nodes["br-shadow-sm"]).toBeDefined();
    expect(nodes["br-shadow-lg"]).toBeDefined();
    const shadowNode = nodes["br-shadow-md"];
    expect(shadowNode).toBeDefined();
    expect(shadowNode.type).toBe("frame");
    if (shadowNode.type === "frame") {
      expect(shadowNode.effects).toBeDefined();
      expect(shadowNode.effects!.length).toBeGreaterThan(0);
    }
  });

  // TC-014: Icons page
  it("page5 (Icons) has icon type nodes", () => {
    const doc = getTemplate("design-system")!.build();
    const nodes = doc.pages.page5.nodes;

    // Has icon nodes
    expect(nodes["ic-icon-home"]).toBeDefined();
    expect(nodes["ic-icon-home"].type).toBe("icon");
    expect(nodes["ic-icon-settings"]).toBeDefined();
    expect(nodes["ic-label-home"]).toBeDefined();
  });

  // TC-015: Buttons page
  it("page6 (Buttons) has button variant nodes", () => {
    const doc = getTemplate("design-system")!.build();
    const nodes = doc.pages.page6.nodes;

    // Primary buttons in 3 sizes
    expect(nodes["bt-primary-sm"]).toBeDefined();
    expect(nodes["bt-primary-md"]).toBeDefined();
    expect(nodes["bt-primary-lg"]).toBeDefined();

    // Other variants
    expect(nodes["bt-secondary-md"]).toBeDefined();
    expect(nodes["bt-ghost-md"]).toBeDefined();
    expect(nodes["bt-destructive-md"]).toBeDefined();
  });

  // TC-016: Form Elements page
  it("page7 (Form Elements) has input, select, checkbox, and radio nodes", () => {
    const doc = getTemplate("design-system")!.build();
    const nodes = doc.pages.page7.nodes;

    expect(nodes["fe-input"]).toBeDefined();
    expect(nodes["fe-select"]).toBeDefined();
    expect(nodes["fe-checkbox"]).toBeDefined();
    expect(nodes["fe-radio"]).toBeDefined();
  });

  // TC-017: Cards page
  it("page8 (Cards) has card variation frames", () => {
    const doc = getTemplate("design-system")!.build();
    const nodes = doc.pages.page8.nodes;

    expect(nodes["cd-basic"]).toBeDefined();
    expect(nodes["cd-basic"].type).toBe("frame");
    expect(nodes["cd-image"]).toBeDefined();
    expect(nodes["cd-status"]).toBeDefined();
  });

  // TC-018: Navigation page
  it("page9 (Navigation) has navbar, tabs, breadcrumbs, and sidebar nodes", () => {
    const doc = getTemplate("design-system")!.build();
    const nodes = doc.pages.page9.nodes;

    expect(nodes["nv-navbar"]).toBeDefined();
    expect(nodes["nv-tabs"]).toBeDefined();
    expect(nodes["nv-breadcrumbs"]).toBeDefined();
    expect(nodes["nv-sidebar"]).toBeDefined();
  });

  // TC-019: Feedback page
  it("page10 (Feedback) has alert, badge, toast, and progress nodes", () => {
    const doc = getTemplate("design-system")!.build();
    const nodes = doc.pages.page10.nodes;

    expect(nodes["fb-alert"]).toBeDefined();
    expect(nodes["fb-badge-section"]).toBeDefined();
    expect(nodes["fb-toast"]).toBeDefined();
    expect(nodes["fb-progress"]).toBeDefined();
  });

  // TC-042 (design-system part): description is non-empty
  it("has a non-empty description", () => {
    const template = getTemplate("design-system");
    expect(template!.description).toBeTruthy();
    expect(template!.description.length).toBeGreaterThan(0);
  });
});

// ── Presentation Template ────────────────────────────────────
describe("Presentation Template", () => {
  // TC-020: Document generation
  it("generates a document with correct version and meta", () => {
    const template = getTemplate("presentation");
    expect(template).toBeDefined();

    const doc = template!.build();
    expect(doc.version).toBe("1.0.0");
    expect(doc.meta.name).toBe("Presentation");
    expect(doc.meta.created).toBeDefined();
    expect(doc.meta.modified).toBeDefined();
    expect(() => new Date(doc.meta.created).toISOString()).not.toThrow();
    expect(() => new Date(doc.meta.modified).toISOString()).not.toThrow();
  });

  // TC-021: Schema validation
  it("validates against CanvasDocumentSchema", async () => {
    const { CanvasDocumentSchema } = await import("../../src/core/schema.js");
    const doc = getTemplate("presentation")!.build();
    const result = CanvasDocumentSchema.safeParse(doc);
    if (!result.success) {
      console.error("Validation errors:", JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  // TC-022: 12-slide structure
  it("has 12 slides, each with a name and root node", () => {
    const doc = getTemplate("presentation")!.build();
    const pageKeys = Object.keys(doc.pages);
    expect(pageKeys.length).toBe(12);

    for (const key of pageKeys) {
      const page = doc.pages[key];
      expect(page.name).toBeTruthy();
      expect(page.nodes.root).toBeDefined();
      expect(page.nodes.root.type).toBe("frame");
    }
  });

  // TC-023: No 13th slide
  it("does not have a 13th slide", () => {
    const doc = getTemplate("presentation")!.build();
    expect(doc.pages.page13).toBeUndefined();
  });

  // TC-024: All slides 1920x1080
  it("has all slides with width 1920 and height 1080", () => {
    const doc = getTemplate("presentation")!.build();
    for (const key of Object.keys(doc.pages)) {
      expect(doc.pages[key].width).toBe(1920);
      expect(doc.pages[key].height).toBe(1080);
    }
  });

  // TC-041: Slide order
  it("has slides in the correct order", () => {
    const doc = getTemplate("presentation")!.build();
    const expectedNames = [
      "\u8868\u7D19",
      "\u76EE\u6B21",
      "\u30BB\u30AF\u30B7\u30E7\u30F3\u533A\u5207\u308A",
      "\u30C6\u30AD\u30B9\u30C8+\u7B87\u6761\u66F8\u304D",
      "2\u30AB\u30E9\u30E0",
      "\u753B\u50CF+\u30C6\u30AD\u30B9\u30C8",
      "\u30C6\u30FC\u30D6\u30EB",
      "\u56F3\u89E3/\u30D5\u30ED\u30FC\u30C1\u30E3\u30FC\u30C8",
      "\u30B0\u30E9\u30D5/\u30C1\u30E3\u30FC\u30C8",
      "\u5F15\u7528/\u30CF\u30A4\u30E9\u30A4\u30C8",
      "\u307E\u3068\u3081",
      "\u6700\u7D42\u30DA\u30FC\u30B8",
    ];
    const actualNames = Array.from({ length: 12 }, (_, i) => doc.pages[`page${i + 1}`].name);
    expect(actualNames).toEqual(expectedNames);
  });

  // TC-025: Design tokens
  it("has tokens with background, accent, spacing, and typography", () => {
    const doc = getTemplate("presentation")!.build();
    const { colors, spacing, typography } = doc.tokens;

    expect(colors.background).toBeDefined();
    expect(colors.accent).toBeDefined();
    expect(Object.keys(spacing).length).toBeGreaterThan(0);
    expect(Object.keys(typography).length).toBeGreaterThan(0);
  });

  // TC-026: Children reference integrity
  it("has valid children references in all slides", () => {
    const doc = getTemplate("presentation")!.build();
    for (const key of Object.keys(doc.pages)) {
      validateChildrenRefs(doc.pages[key]);
    }
  });

  // TC-027: Cover slide
  it("page1 (\u8868\u7D19) has 4 text nodes", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page1.nodes;

    expect(nodes["cover-title"]).toBeDefined();
    expect(nodes["cover-title"].type).toBe("text");
    expect(nodes["cover-subtitle"]).toBeDefined();
    expect(nodes["cover-date"]).toBeDefined();
    expect(nodes["cover-presenter"]).toBeDefined();
  });

  // TC-028: TOC slide
  it("page2 (\u76EE\u6B21) has numbered items", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page2.nodes;

    expect(nodes["toc-heading"]).toBeDefined();
    // Has numbered items
    expect(nodes["toc-item-1"]).toBeDefined();
    expect(nodes["toc-item-1"].type).toBe("text");
    if (nodes["toc-item-1"].type === "text") {
      expect(nodes["toc-item-1"].content).toMatch(/^1\./);
    }
  });

  // TC-029: Section divider slide
  it("page3 (\u30BB\u30AF\u30B7\u30E7\u30F3\u533A\u5207\u308A) has title and subtitle", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page3.nodes;

    expect(nodes["sec-title"]).toBeDefined();
    expect(nodes["sec-title"].type).toBe("text");
    expect(nodes["sec-subtitle"]).toBeDefined();
    expect(nodes["sec-subtitle"].type).toBe("text");
  });

  // TC-030: Bullet list slide
  it("page4 (\u30C6\u30AD\u30B9\u30C8+\u7B87\u6761\u66F8\u304D) has heading and bullet items", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page4.nodes;

    expect(nodes["bl-heading"]).toBeDefined();
    expect(nodes["bl-list"]).toBeDefined();
    expect(nodes["bl-item-1"]).toBeDefined();
    // Bullet items are frame(row) with bullet text + content text
    expect(nodes["bl-item-1"].type).toBe("frame");
    expect(nodes["bl-bullet-1"]).toBeDefined();
    expect(nodes["bl-text-1"]).toBeDefined();
  });

  // TC-031: Two-column slide
  it("page5 (2\u30AB\u30E9\u30E0) has direction:row columns frame with 2 children", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page5.nodes;

    expect(nodes["tc-columns"]).toBeDefined();
    expect(nodes["tc-columns"].type).toBe("frame");
    if (nodes["tc-columns"].type === "frame") {
      expect(nodes["tc-columns"].layout?.direction).toBe("row");
      expect(nodes["tc-columns"].children).toContain("tc-left");
      expect(nodes["tc-columns"].children).toContain("tc-right");
    }
  });

  // TC-032: Image + text slide
  it("page6 (\u753B\u50CF+\u30C6\u30AD\u30B9\u30C8) has frame placeholder with icon and text", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page6.nodes;

    // Image placeholder is a frame with icon (not an image node)
    expect(nodes["it-image-area"]).toBeDefined();
    expect(nodes["it-image-area"].type).toBe("frame");
    expect(nodes["it-image-icon"]).toBeDefined();
    expect(nodes["it-image-icon"].type).toBe("icon");
    expect(nodes["it-title"]).toBeDefined();
    expect(nodes["it-description"]).toBeDefined();
  });

  // TC-033: Table slide
  it("page7 (\u30C6\u30FC\u30D6\u30EB) has header row and data rows", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page7.nodes;

    expect(nodes["tb-header"]).toBeDefined();
    expect(nodes["tb-header"].type).toBe("frame");
    // 3 header cells
    expect(nodes["tb-th-1"]).toBeDefined();
    expect(nodes["tb-th-2"]).toBeDefined();
    expect(nodes["tb-th-3"]).toBeDefined();
    // 4 data rows
    expect(nodes["tb-row-1"]).toBeDefined();
    expect(nodes["tb-row-2"]).toBeDefined();
    expect(nodes["tb-row-3"]).toBeDefined();
    expect(nodes["tb-row-4"]).toBeDefined();
  });

  // TC-034: Flowchart slide
  it("page8 (\u56F3\u89E3/\u30D5\u30ED\u30FC\u30C1\u30E3\u30FC\u30C8) has step frames and vector arrows", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page8.nodes;

    // Step frames
    expect(nodes["fc-step-1"]).toBeDefined();
    expect(nodes["fc-step-1"].type).toBe("frame");
    expect(nodes["fc-step-2"]).toBeDefined();
    expect(nodes["fc-step-3"]).toBeDefined();

    // Vector arrows
    expect(nodes["fc-arrow-1"]).toBeDefined();
    expect(nodes["fc-arrow-1"].type).toBe("vector");
    expect(nodes["fc-arrow-2"]).toBeDefined();
    expect(nodes["fc-arrow-2"].type).toBe("vector");
  });

  // TC-035: Chart slide
  it("page9 (\u30B0\u30E9\u30D5/\u30C1\u30E3\u30FC\u30C8) has bar frames and label texts", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page9.nodes;

    expect(nodes["ch-area"]).toBeDefined();
    // Bar fills
    expect(nodes["ch-fill-q1"]).toBeDefined();
    expect(nodes["ch-fill-q1"].type).toBe("frame");
    expect(nodes["ch-fill-q4"]).toBeDefined();
    // Labels
    expect(nodes["ch-label-q1"]).toBeDefined();
    expect(nodes["ch-label-q1"].type).toBe("text");
  });

  // TC-036: Quote slide
  it("page10 (\u5F15\u7528/\u30CF\u30A4\u30E9\u30A4\u30C8) has quote text", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page10.nodes;

    expect(nodes["qt-quote"]).toBeDefined();
    expect(nodes["qt-quote"].type).toBe("text");
    expect(nodes["qt-source"]).toBeDefined();
  });

  // TC-037: Summary slide
  it("page11 (\u307E\u3068\u3081) has key point texts", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page11.nodes;

    expect(nodes["sm-title"]).toBeDefined();
    expect(nodes["sm-point-1"]).toBeDefined();
    expect(nodes["sm-point-1"].type).toBe("text");
    expect(nodes["sm-points"]).toBeDefined();
  });

  // TC-038: End page
  it("page12 (\u6700\u7D42\u30DA\u30FC\u30B8) has Thank you and contact texts", () => {
    const doc = getTemplate("presentation")!.build();
    const nodes = doc.pages.page12.nodes;

    expect(nodes["end-thankyou"]).toBeDefined();
    expect(nodes["end-thankyou"].type).toBe("text");
    if (nodes["end-thankyou"].type === "text") {
      expect(nodes["end-thankyou"].content).toContain("Thank you");
    }
    expect(nodes["end-email"]).toBeDefined();
    expect(nodes["end-website"]).toBeDefined();
  });

  // TC-042 (presentation part): description is non-empty
  it("has a non-empty description", () => {
    const template = getTemplate("presentation");
    expect(template!.description).toBeTruthy();
    expect(template!.description.length).toBeGreaterThan(0);
  });
});
