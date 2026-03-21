import {
  ColorTokenSchema,
  SpacingTokenSchema,
  TypographyTokenSchema,
  BorderRadiusTokenSchema,
  ShadowTokenSchema,
  BreakpointTokenSchema,
  TokensSchema,
  FrameNodeSchema,
  TextNodeSchema,
  ImageNodeSchema,
  IconNodeSchema,
  ComponentNodeSchema,
  VectorNodeSchema,
  NodeSchema,
  LayoutSchema,
  ComponentDefinitionSchema,
  PageSchema,
  MetaSchema,
  CanvasDocumentSchema,
} from "../../src/core/schema.js";
import { buildRawDocument } from "../helpers/create-test-document.js";

// ============================================================
// Token Schemas
// ============================================================

describe("ColorTokenSchema", () => {
  it("validates a color token with value and description", () => {
    const result = ColorTokenSchema.safeParse({
      value: "#3B82F6",
      description: "Primary blue",
    });
    expect(result.success).toBe(true);
  });

  it("validates a color token with value only", () => {
    const result = ColorTokenSchema.safeParse({ value: "#fff" });
    expect(result.success).toBe(true);
  });

  it("rejects a color token missing value", () => {
    const result = ColorTokenSchema.safeParse({ description: "No value" });
    expect(result.success).toBe(false);
  });
});

describe("SpacingTokenSchema", () => {
  it("validates a spacing token", () => {
    const result = SpacingTokenSchema.safeParse({ value: "16px" });
    expect(result.success).toBe(true);
  });

  it("rejects missing value", () => {
    const result = SpacingTokenSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("TypographyTokenSchema", () => {
  it("validates a complete typography token", () => {
    const result = TypographyTokenSchema.safeParse({
      fontFamily: "Inter",
      fontSize: "16px",
      fontWeight: "400",
      lineHeight: "1.5",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a typography token missing required fields", () => {
    const result = TypographyTokenSchema.safeParse({
      fontFamily: "Inter",
    });
    expect(result.success).toBe(false);
  });
});

describe("BorderRadiusTokenSchema", () => {
  it("validates a border radius token", () => {
    const result = BorderRadiusTokenSchema.safeParse({ value: "8px" });
    expect(result.success).toBe(true);
  });
});

describe("ShadowTokenSchema", () => {
  it("validates a shadow token", () => {
    const result = ShadowTokenSchema.safeParse({
      value: "0 4px 6px rgba(0,0,0,0.1)",
    });
    expect(result.success).toBe(true);
  });
});

describe("BreakpointTokenSchema", () => {
  it("validates a breakpoint token", () => {
    const result = BreakpointTokenSchema.safeParse({ value: "768px" });
    expect(result.success).toBe(true);
  });
});

describe("TokensSchema", () => {
  it("provides defaults for all categories when given empty object", () => {
    const result = TokensSchema.parse({});
    expect(result.colors).toEqual({});
    expect(result.spacing).toEqual({});
    expect(result.typography).toEqual({});
    expect(result.borderRadius).toEqual({});
    expect(result.shadows).toEqual({});
    expect(result.breakpoints).toEqual({});
  });

  it("accepts populated token categories", () => {
    const result = TokensSchema.safeParse({
      colors: { primary: { value: "#000" } },
      spacing: { sm: { value: "8px" } },
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Node Schemas
// ============================================================

describe("FrameNodeSchema", () => {
  it("validates a frame node with children", () => {
    const result = FrameNodeSchema.safeParse({
      type: "frame",
      name: "Container",
      layout: { direction: "row" },
      children: ["child1", "child2"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults children to empty array", () => {
    const result = FrameNodeSchema.parse({
      type: "frame",
      name: "Empty Frame",
    });
    expect(result.children).toEqual([]);
  });
});

describe("TextNodeSchema", () => {
  it("validates a text node", () => {
    const result = TextNodeSchema.safeParse({
      type: "text",
      name: "Title",
      content: "Hello World",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a text node missing content", () => {
    const result = TextNodeSchema.safeParse({
      type: "text",
      name: "Title",
    });
    expect(result.success).toBe(false);
  });
});

describe("ImageNodeSchema", () => {
  it("validates an image node with optional fields", () => {
    const result = ImageNodeSchema.safeParse({
      type: "image",
      name: "Hero",
      src: "https://example.com/img.png",
      alt: "Example image",
    });
    expect(result.success).toBe(true);
  });

  it("validates an image node without src and alt", () => {
    const result = ImageNodeSchema.safeParse({
      type: "image",
      name: "Placeholder",
    });
    expect(result.success).toBe(true);
  });
});

describe("IconNodeSchema", () => {
  it("validates an icon node", () => {
    const result = IconNodeSchema.safeParse({
      type: "icon",
      name: "Settings Icon",
      icon: "lucide:settings",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an icon node missing icon field", () => {
    const result = IconNodeSchema.safeParse({
      type: "icon",
      name: "Missing",
    });
    expect(result.success).toBe(false);
  });
});

describe("ComponentNodeSchema", () => {
  it("validates a component node", () => {
    const result = ComponentNodeSchema.safeParse({
      type: "component",
      name: "CTA",
      componentRef: "Button",
      props: { text: "Click" },
      overrides: {},
    });
    expect(result.success).toBe(true);
  });

  it("defaults props and overrides to empty objects", () => {
    const result = ComponentNodeSchema.parse({
      type: "component",
      name: "CTA",
      componentRef: "Button",
    });
    expect(result.props).toEqual({});
    expect(result.overrides).toEqual({});
  });
});

describe("VectorNodeSchema", () => {
  it("validates a vector node", () => {
    const result = VectorNodeSchema.safeParse({
      type: "vector",
      name: "Arrow",
      path: "M0 0 L10 10",
      viewBox: "0 0 24 24",
    });
    expect(result.success).toBe(true);
  });

  it("validates a vector node without optional fields", () => {
    const result = VectorNodeSchema.safeParse({
      type: "vector",
      name: "Blank",
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// NodeSchema discriminated union
// ============================================================

describe("NodeSchema", () => {
  it("resolves to FrameNodeSchema for type=frame", () => {
    const result = NodeSchema.safeParse({
      type: "frame",
      name: "F",
      children: [],
    });
    expect(result.success).toBe(true);
  });

  it("resolves to TextNodeSchema for type=text", () => {
    const result = NodeSchema.safeParse({
      type: "text",
      name: "T",
      content: "hi",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown type", () => {
    const result = NodeSchema.safeParse({
      type: "unknown",
      name: "X",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// LayoutSchema
// ============================================================

describe("LayoutSchema", () => {
  it("defaults direction to column", () => {
    const result = LayoutSchema.parse({});
    expect(result!.direction).toBe("column");
  });

  it("accepts row direction with optional fields", () => {
    const result = LayoutSchema.parse({
      direction: "row",
      gap: "16px",
      align: "center",
      justify: "between",
      wrap: true,
    });
    expect(result).toEqual({
      direction: "row",
      gap: "16px",
      align: "center",
      justify: "between",
      wrap: true,
    });
  });

  it("accepts numeric gap and coerces to string", () => {
    const result = LayoutSchema.parse({ gap: 16 });
    expect(result!.gap).toBe("16");
  });

  it("accepts string gap as before", () => {
    const result = LayoutSchema.parse({ gap: "24px" });
    expect(result!.gap).toBe("24px");
  });

  it("accepts numeric zero gap", () => {
    const result = LayoutSchema.parse({ gap: 0 });
    expect(result!.gap).toBe("0");
  });
});

// ============================================================
// ComponentDefinitionSchema
// ============================================================

describe("ComponentDefinitionSchema", () => {
  it("validates a full component definition with template", () => {
    const result = ComponentDefinitionSchema.safeParse({
      description: "A button",
      variants: { size: { sm: { padding: "4px" } } },
      props: ["text"],
      defaultProps: { text: "Click" },
      template: {
        type: "frame",
        styles: { backgroundColor: "#000" },
        children: [{ type: "text", content: "Click" }],
      },
    });
    expect(result.success).toBe(true);
  });

  it("provides defaults for optional fields", () => {
    const result = ComponentDefinitionSchema.parse({});
    expect(result.variants).toEqual({});
    expect(result.props).toEqual([]);
    expect(result.defaultProps).toEqual({});
  });
});

// ============================================================
// PageSchema
// ============================================================

describe("PageSchema", () => {
  it("validates a page with nodes", () => {
    const result = PageSchema.safeParse({
      name: "Home",
      width: 1440,
      height: null,
      x: 0,
      y: 0,
      nodes: {
        root: { type: "frame", name: "Root", children: [] },
      },
    });
    expect(result.success).toBe(true);
  });

  it("defaults width to 1440", () => {
    const result = PageSchema.parse({
      name: "Defaults",
      nodes: {},
    });
    expect(result.width).toBe(1440);
  });

  it("defaults x and y to 0", () => {
    const result = PageSchema.parse({
      name: "Defaults",
      nodes: {},
    });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("accepts custom x and y coordinates", () => {
    const result = PageSchema.parse({
      name: "Positioned",
      x: 500,
      y: 300,
      nodes: {},
    });
    expect(result.x).toBe(500);
    expect(result.y).toBe(300);
  });

  it("accepts negative x and y coordinates", () => {
    const result = PageSchema.parse({
      name: "Negative",
      x: -100,
      y: -200,
      nodes: {},
    });
    expect(result.x).toBe(-100);
    expect(result.y).toBe(-200);
  });

  it("validates a page without x and y (backward compatibility)", () => {
    const result = PageSchema.safeParse({
      name: "Legacy",
      width: 1440,
      height: null,
      nodes: {
        root: { type: "frame", name: "Root", children: [] },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.x).toBe(0);
      expect(result.data.y).toBe(0);
    }
  });

  it("rejects a page missing name", () => {
    const result = PageSchema.safeParse({
      nodes: {},
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// MetaSchema
// ============================================================

describe("MetaSchema", () => {
  it("validates complete meta", () => {
    const result = MetaSchema.safeParse({
      name: "Doc",
      created: "2025-01-01T00:00:00.000Z",
      modified: "2025-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects meta missing modified", () => {
    const result = MetaSchema.safeParse({
      name: "Doc",
      created: "2025-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// CanvasDocumentSchema
// ============================================================

describe("CanvasDocumentSchema", () => {
  it("validates a full raw document", () => {
    const raw = buildRawDocument();
    const result = CanvasDocumentSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it("defaults version to 1.0.0", () => {
    const raw = buildRawDocument();
    delete (raw as Record<string, unknown>).version;
    const result = CanvasDocumentSchema.parse(raw);
    expect(result.version).toBe("1.0.0");
  });

  it("rejects a document missing pages", () => {
    const raw = buildRawDocument();
    delete (raw as Record<string, unknown>).pages;
    const result = CanvasDocumentSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it("rejects a document with invalid meta", () => {
    const result = CanvasDocumentSchema.safeParse({
      version: "1.0.0",
      meta: { name: 123 },
      pages: {},
    });
    expect(result.success).toBe(false);
  });
});
