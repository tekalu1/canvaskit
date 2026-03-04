import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:crypto", () => ({
  randomUUID: () => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
}));

import { NodeManager } from "../../src/core/node.js";
import {
  createDocumentWithNodes,
} from "../helpers/create-test-document.js";
import type { Document } from "../../src/core/document.js";
import {
  stylesToClasses,
  layoutToClasses,
  strokeToClasses,
  effectsToClasses,
  gradientToCss,
  gradientToClasses,
  buildFullClassString,
} from "../../src/export/shared.js";
import type { Tokens, Stroke, Effect, Gradient } from "../../src/core/schema.js";
import { CanvasDocumentSchema } from "../../src/core/schema.js";

const emptyTokens: Tokens = {
  colors: {},
  spacing: {},
  typography: {},
  borderRadius: {},
  shadows: {},
  breakpoints: {},
};

// ============================================================
// Step 1: borderRadius array + clip
// ============================================================

describe("borderRadius array support", () => {
  it("should convert scalar borderRadius to single rounded class", () => {
    const result = stylesToClasses({ borderRadius: "8px" }, emptyTokens);
    expect(result).toBe("rounded-[8px]");
  });

  it("should convert array borderRadius to per-corner classes", () => {
    const result = stylesToClasses(
      { borderRadius: ["4px", "8px", "12px", "16px"] },
      emptyTokens
    );
    expect(result).toContain("rounded-tl-[4px]");
    expect(result).toContain("rounded-tr-[8px]");
    expect(result).toContain("rounded-br-[12px]");
    expect(result).toContain("rounded-bl-[16px]");
  });

  it("should convert numeric array borderRadius", () => {
    const result = stylesToClasses(
      { borderRadius: [0, 10, 0, 10] },
      emptyTokens
    );
    expect(result).toContain("rounded-tl-[0]");
    expect(result).toContain("rounded-tr-[10]");
    expect(result).toContain("rounded-br-[0]");
    expect(result).toContain("rounded-bl-[10]");
  });
});

describe("frame clip property", () => {
  let doc: Document;
  let nodes: NodeManager;

  beforeEach(() => {
    doc = createDocumentWithNodes();
    nodes = new NodeManager(doc);
  });

  it("should add a frame with clip: true", () => {
    const result = nodes.add("page1", [
      { type: "frame", name: "Clipped", parentId: "root", clip: true },
    ]);
    const node = nodes.get("page1", result[0].id);
    expect(node).toBeDefined();
    expect((node as any).clip).toBe(true);
  });

  it("should add a frame with clip: false by default", () => {
    const result = nodes.add("page1", [
      { type: "frame", name: "Unclipped", parentId: "root" },
    ]);
    const node = nodes.get("page1", result[0].id);
    expect((node as any).clip).toBe(false);
  });

  it("should update clip via update()", () => {
    const result = nodes.add("page1", [
      { type: "frame", name: "Frame1", parentId: "root", clip: false },
    ]);
    nodes.update("page1", [{ id: result[0].id, clip: true }]);
    const node = nodes.get("page1", result[0].id);
    expect((node as any).clip).toBe(true);
  });
});

// ============================================================
// Step 2: Structured stroke
// ============================================================

describe("strokeToClasses", () => {
  it("should return empty string for undefined stroke", () => {
    expect(strokeToClasses(undefined)).toBe("");
  });

  it("should convert solid stroke to Tailwind classes", () => {
    const stroke: Stroke = { color: "#000000", width: "2px", style: "solid" };
    const result = strokeToClasses(stroke);
    expect(result).toContain("border-[2px]");
    expect(result).toContain("border-solid");
    expect(result).toContain("border-[#000000]");
  });

  it("should convert dashed stroke", () => {
    const stroke: Stroke = { color: "#ff0000", width: "1px", style: "dashed" };
    const result = strokeToClasses(stroke);
    expect(result).toContain("border-dashed");
    expect(result).toContain("border-[#ff0000]");
  });

  it("should handle numeric width", () => {
    const stroke: Stroke = { color: "#333", width: 3, style: "dotted" };
    const result = strokeToClasses(stroke);
    expect(result).toContain("border-[3]");
    expect(result).toContain("border-dotted");
  });
});

describe("stroke on nodes", () => {
  let doc: Document;
  let nodes: NodeManager;

  beforeEach(() => {
    doc = createDocumentWithNodes();
    nodes = new NodeManager(doc);
  });

  it("should add a node with stroke", () => {
    const result = nodes.add("page1", [
      {
        type: "frame",
        name: "Bordered",
        parentId: "root",
        stroke: { color: "#000", width: "2px", style: "solid" },
      },
    ]);
    const node = nodes.get("page1", result[0].id) as any;
    expect(node.stroke).toEqual({ color: "#000", width: "2px", style: "solid" });
  });

  it("should update stroke via update()", () => {
    const result = nodes.add("page1", [
      { type: "frame", name: "Frame2", parentId: "root" },
    ]);
    nodes.update("page1", [
      { id: result[0].id, stroke: { color: "#f00", width: "3px", style: "dashed" } },
    ]);
    const node = nodes.get("page1", result[0].id) as any;
    expect(node.stroke.color).toBe("#f00");
    expect(node.stroke.style).toBe("dashed");
  });
});

// ============================================================
// Step 2: Effects
// ============================================================

describe("effectsToClasses", () => {
  it("should return empty string for undefined/empty effects", () => {
    expect(effectsToClasses(undefined)).toBe("");
    expect(effectsToClasses([])).toBe("");
  });

  it("should convert shadow effect to Tailwind class", () => {
    const effects: Effect[] = [
      {
        type: "shadow",
        offsetX: "0",
        offsetY: "4px",
        blur: "6px",
        spread: "0",
        color: "rgba(0,0,0,0.1)",
        inset: false,
      },
    ];
    const result = effectsToClasses(effects);
    expect(result).toContain("shadow-[");
  });

  it("should convert inset shadow", () => {
    const effects: Effect[] = [
      {
        type: "shadow",
        offsetX: "0",
        offsetY: "2px",
        blur: "4px",
        spread: "0",
        color: "#000",
        inset: true,
      },
    ];
    const result = effectsToClasses(effects);
    expect(result).toContain("inset_");
  });

  it("should convert blur effect", () => {
    const effects: Effect[] = [{ type: "blur", radius: "10px" }];
    const result = effectsToClasses(effects);
    expect(result).toBe("blur-[10px]");
  });

  it("should convert backdrop-blur effect", () => {
    const effects: Effect[] = [{ type: "backdrop-blur", radius: "8px" }];
    const result = effectsToClasses(effects);
    expect(result).toBe("backdrop-blur-[8px]");
  });

  it("should combine multiple effects", () => {
    const effects: Effect[] = [
      {
        type: "shadow",
        offsetX: "0",
        offsetY: "4px",
        blur: "6px",
        spread: "0",
        color: "#000",
        inset: false,
      },
      { type: "blur", radius: "5px" },
    ];
    const result = effectsToClasses(effects);
    expect(result).toContain("shadow-[");
    expect(result).toContain("blur-[5px]");
  });
});

describe("effects on nodes", () => {
  let doc: Document;
  let nodes: NodeManager;

  beforeEach(() => {
    doc = createDocumentWithNodes();
    nodes = new NodeManager(doc);
  });

  it("should add a node with effects", () => {
    const result = nodes.add("page1", [
      {
        type: "frame",
        name: "Shadowed",
        parentId: "root",
        effects: [
          {
            type: "shadow",
            offsetX: "0",
            offsetY: "4px",
            blur: "6px",
            spread: "0",
            color: "#000",
            inset: false,
          },
        ],
      },
    ]);
    const node = nodes.get("page1", result[0].id) as any;
    expect(node.effects).toHaveLength(1);
    expect(node.effects[0].type).toBe("shadow");
  });

  it("should update effects via update()", () => {
    const result = nodes.add("page1", [
      { type: "frame", name: "Frame3", parentId: "root" },
    ]);
    nodes.update("page1", [
      {
        id: result[0].id,
        effects: [{ type: "blur", radius: "10px" }],
      },
    ]);
    const node = nodes.get("page1", result[0].id) as any;
    expect(node.effects).toHaveLength(1);
    expect(node.effects[0].type).toBe("blur");
  });
});

// ============================================================
// Step 3: Gradient
// ============================================================

describe("gradientToCss", () => {
  it("should generate linear-gradient CSS", () => {
    const gradient: Gradient = {
      type: "linear",
      angle: 90,
      colors: [
        { color: "#ff0000", position: 0 },
        { color: "#0000ff", position: 1 },
      ],
    };
    const css = gradientToCss(gradient);
    expect(css).toBe("linear-gradient(90deg, #ff0000 0%, #0000ff 100%)");
  });

  it("should use default angle 180 for linear gradient", () => {
    const gradient: Gradient = {
      type: "linear",
      colors: [
        { color: "#000", position: 0 },
        { color: "#fff", position: 1 },
      ],
    };
    const css = gradientToCss(gradient);
    expect(css).toContain("180deg");
  });

  it("should generate radial-gradient CSS", () => {
    const gradient: Gradient = {
      type: "radial",
      colors: [
        { color: "#ff0", position: 0 },
        { color: "#00f", position: 1 },
      ],
    };
    const css = gradientToCss(gradient);
    expect(css).toBe("radial-gradient(circle, #ff0 0%, #00f 100%)");
  });

  it("should generate conic-gradient CSS", () => {
    const gradient: Gradient = {
      type: "conic",
      angle: 45,
      colors: [
        { color: "red", position: 0 },
        { color: "blue", position: 0.5 },
        { color: "green", position: 1 },
      ],
    };
    const css = gradientToCss(gradient);
    expect(css).toBe("conic-gradient(from 45deg, red 0%, blue 50%, green 100%)");
  });

  it("should handle multi-stop gradients", () => {
    const gradient: Gradient = {
      type: "linear",
      angle: 135,
      colors: [
        { color: "#f00", position: 0 },
        { color: "#0f0", position: 0.33 },
        { color: "#00f", position: 0.66 },
        { color: "#fff", position: 1 },
      ],
    };
    const css = gradientToCss(gradient);
    expect(css).toContain("135deg");
    expect(css).toContain("#f00 0%");
    expect(css).toContain("#0f0 33%");
    expect(css).toContain("#00f 66%");
    expect(css).toContain("#fff 100%");
  });
});

describe("gradientToClasses", () => {
  it("should return empty string for undefined gradient", () => {
    expect(gradientToClasses(undefined)).toBe("");
  });

  it("should return Tailwind arbitrary background-image class", () => {
    const gradient: Gradient = {
      type: "linear",
      angle: 90,
      colors: [
        { color: "#ff0000", position: 0 },
        { color: "#0000ff", position: 1 },
      ],
    };
    const result = gradientToClasses(gradient);
    expect(result).toContain("[background-image:");
    expect(result).toContain("linear-gradient");
  });
});

describe("gradient on nodes", () => {
  let doc: Document;
  let nodes: NodeManager;

  beforeEach(() => {
    doc = createDocumentWithNodes();
    nodes = new NodeManager(doc);
  });

  it("should add a node with gradient", () => {
    const result = nodes.add("page1", [
      {
        type: "frame",
        name: "Gradient Box",
        parentId: "root",
        gradient: {
          type: "linear",
          angle: 45,
          colors: [
            { color: "#ff0000", position: 0 },
            { color: "#0000ff", position: 1 },
          ],
        },
      },
    ]);
    const node = nodes.get("page1", result[0].id) as any;
    expect(node.gradient).toBeDefined();
    expect(node.gradient.type).toBe("linear");
    expect(node.gradient.colors).toHaveLength(2);
  });

  it("should update gradient via update()", () => {
    const result = nodes.add("page1", [
      { type: "frame", name: "Frame4", parentId: "root" },
    ]);
    nodes.update("page1", [
      {
        id: result[0].id,
        gradient: {
          type: "radial",
          colors: [
            { color: "#000", position: 0 },
            { color: "#fff", position: 1 },
          ],
        },
      },
    ]);
    const node = nodes.get("page1", result[0].id) as any;
    expect(node.gradient.type).toBe("radial");
  });

  it("should add gradient to text nodes too", () => {
    const result = nodes.add("page1", [
      {
        type: "text",
        name: "Gradient Text",
        parentId: "root",
        content: "Hello",
        gradient: {
          type: "linear",
          angle: 90,
          colors: [
            { color: "#ff0000", position: 0 },
            { color: "#0000ff", position: 1 },
          ],
        },
      },
    ]);
    const node = nodes.get("page1", result[0].id) as any;
    expect(node.gradient).toBeDefined();
  });
});

// ============================================================
// Step 4: Layout "none" mode
// ============================================================

describe("layout none mode", () => {
  it("should return 'relative' for direction 'none'", () => {
    const result = layoutToClasses(
      { direction: "none" },
      emptyTokens
    );
    expect(result).toBe("relative");
  });

  it("should still return flex classes for 'row' direction", () => {
    const result = layoutToClasses(
      { direction: "row", gap: "8px" },
      emptyTokens
    );
    expect(result).toContain("flex");
    expect(result).toContain("flex-row");
    expect(result).toContain("gap-[8px]");
  });

  it("should still return flex classes for 'column' direction", () => {
    const result = layoutToClasses(
      { direction: "column" },
      emptyTokens
    );
    expect(result).toContain("flex");
    expect(result).toContain("flex-col");
  });

  it("should accept 'none' in schema validation", () => {
    const data = {
      version: "1.0.0",
      meta: { name: "Test", created: "2025-01-01T00:00:00Z", modified: "2025-01-01T00:00:00Z" },
      tokens: {},
      components: {},
      pages: {
        page1: {
          name: "Page 1",
          width: 1440,
          height: null,
          nodes: {
            root: {
              type: "frame",
              name: "Root",
              layout: { direction: "none" },
              children: [],
            },
          },
        },
      },
    };
    const result = CanvasDocumentSchema.parse(data);
    expect(result.pages.page1.nodes.root.type).toBe("frame");
  });
});

// ============================================================
// Step 5: Variables & Themes
// ============================================================

describe("VariableManager", () => {
  let doc: Document;

  beforeEach(() => {
    doc = createDocumentWithNodes();
  });

  it("should set and get a variable", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    vm.set("primary", "color", "#3B82F6");
    const variable = vm.get("primary");
    expect(variable).toBeDefined();
    expect(variable!.type).toBe("color");
    expect(variable!.values[0].value).toBe("#3B82F6");
  });

  it("should resolve a variable to its default value", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    vm.set("primary", "color", "#3B82F6");
    expect(vm.resolve("primary")).toBe("#3B82F6");
  });

  it("should resolve a variable with theme context", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    vm.set("primary", "color", "#3B82F6"); // default
    vm.set("primary", "color", "#60A5FA", { mode: "dark" }); // dark theme

    expect(vm.resolve("primary")).toBe("#3B82F6");
    expect(vm.resolve("primary", { mode: "dark" })).toBe("#60A5FA");
    expect(vm.resolve("primary", { mode: "light" })).toBe("#3B82F6"); // fallback
  });

  it("should delete a variable", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    vm.set("primary", "color", "#3B82F6");
    expect(vm.delete("primary")).toBe(true);
    expect(vm.get("primary")).toBeUndefined();
  });

  it("should return false for deleting non-existent variable", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    expect(vm.delete("nonexistent")).toBe(false);
  });

  it("should list all variables", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    vm.set("primary", "color", "#3B82F6");
    vm.set("spacing-md", "spacing", "16px");
    const list = vm.list();
    expect(list).toHaveLength(2);
    expect(list.map((l) => l.name)).toContain("primary");
    expect(list.map((l) => l.name)).toContain("spacing-md");
  });

  it("should set and get theme axes", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    vm.setThemeAxis("mode", ["light", "dark"]);
    const axes = vm.getThemeAxes();
    expect(axes.mode).toEqual(["light", "dark"]);
  });

  it("should delete a theme axis", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    vm.setThemeAxis("mode", ["light", "dark"]);
    expect(vm.deleteThemeAxis("mode")).toBe(true);
    expect(vm.getThemeAxes().mode).toBeUndefined();
  });

  it("should export CSS custom properties", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    vm.set("primary", "color", "#3B82F6");
    vm.set("primary", "color", "#60A5FA", { mode: "dark" });
    vm.setThemeAxis("mode", ["light", "dark"]);

    const css = vm.toCssCustomProperties();
    expect(css).toContain(":root {");
    expect(css).toContain("--primary: #3B82F6;");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("--primary: #60A5FA;");
  });

  it("should return empty string for no variables", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    expect(vm.toCssCustomProperties()).toBe("");
  });

  it("should update existing default value", async () => {
    const { VariableManager } = await import("../../src/core/variable.js");
    const vm = new VariableManager(doc);
    vm.set("primary", "color", "#3B82F6");
    vm.set("primary", "color", "#2563EB"); // update default
    expect(vm.resolve("primary")).toBe("#2563EB");
    expect(vm.get("primary")!.values).toHaveLength(1);
  });

  it("should handle variables in schema validation", () => {
    const data = {
      version: "1.0.0",
      meta: { name: "Test", created: "2025-01-01T00:00:00Z", modified: "2025-01-01T00:00:00Z" },
      tokens: {},
      variables: {
        themeAxes: { mode: ["light", "dark"] },
        definitions: {
          primary: {
            type: "color",
            values: [
              { value: "#3B82F6" },
              { value: "#60A5FA", theme: { mode: "dark" } },
            ],
          },
        },
      },
      components: {},
      pages: {
        page1: {
          name: "Page 1",
          width: 1440,
          height: null,
          nodes: {
            root: { type: "frame", name: "Root", layout: { direction: "column" }, children: [] },
          },
        },
      },
    };
    const result = CanvasDocumentSchema.parse(data);
    expect(result.variables).toBeDefined();
    expect(result.variables!.definitions.primary.type).toBe("color");
  });
});

// ============================================================
// Step 2+3+4 combined: buildFullClassString
// ============================================================

describe("buildFullClassString", () => {
  it("should combine layout, styles, stroke, effects, and gradient classes", () => {
    const result = buildFullClassString(
      { direction: "row", gap: "8px" },
      { backgroundColor: "#fff", padding: "16px" },
      emptyTokens,
      { color: "#000", width: "1px", style: "solid" },
      [{ type: "blur", radius: "4px" }],
      {
        type: "linear",
        angle: 90,
        colors: [
          { color: "#f00", position: 0 },
          { color: "#00f", position: 1 },
        ],
      }
    );
    expect(result).toContain("flex");
    expect(result).toContain("flex-row");
    expect(result).toContain("bg-[#fff]");
    expect(result).toContain("p-[16px]");
    expect(result).toContain("border-[1px]");
    expect(result).toContain("blur-[4px]");
    expect(result).toContain("[background-image:");
  });

  it("should work with no visual primitives", () => {
    const result = buildFullClassString(
      { direction: "column" },
      { color: "#333" },
      emptyTokens
    );
    expect(result).toContain("flex");
    expect(result).toContain("text-[#333]");
    expect(result).not.toContain("border-");
    expect(result).not.toContain("shadow-");
    expect(result).not.toContain("blur-");
  });
});

// ============================================================
// Schema backward compatibility
// ============================================================

describe("schema backward compatibility", () => {
  it("should parse existing documents without new properties", () => {
    const data = {
      version: "1.0.0",
      meta: { name: "Old Doc", created: "2025-01-01T00:00:00Z", modified: "2025-01-01T00:00:00Z" },
      tokens: {},
      components: {},
      pages: {
        page1: {
          name: "Page 1",
          width: 1440,
          height: null,
          nodes: {
            root: {
              type: "frame",
              name: "Root",
              layout: { direction: "column" },
              children: [],
            },
            title: {
              type: "text",
              name: "Title",
              content: "Hello",
              styles: { fontSize: "32px", fontWeight: "bold" },
            },
          },
        },
      },
    };
    const result = CanvasDocumentSchema.parse(data);
    expect(result.pages.page1.nodes.root.type).toBe("frame");
    // No variables, stroke, effects, gradient - all should be undefined
    expect(result.variables).toBeUndefined();
    expect(result.pages.page1.nodes.root.stroke).toBeUndefined();
    expect(result.pages.page1.nodes.root.effects).toBeUndefined();
    expect(result.pages.page1.nodes.root.gradient).toBeUndefined();
  });

  it("should parse documents with new visual primitives", () => {
    const data = {
      version: "1.0.0",
      meta: { name: "New Doc", created: "2025-01-01T00:00:00Z", modified: "2025-01-01T00:00:00Z" },
      tokens: {},
      components: {},
      pages: {
        page1: {
          name: "Page 1",
          width: 1440,
          height: null,
          nodes: {
            root: {
              type: "frame",
              name: "Root",
              layout: { direction: "none" },
              children: ["box"],
              clip: true,
              stroke: { color: "#000", width: "2px", style: "solid" },
              effects: [{ type: "shadow", offsetX: "0", offsetY: "4px", blur: "6px", spread: "0", color: "#000", inset: false }],
              gradient: {
                type: "linear",
                angle: 45,
                colors: [
                  { color: "#ff0000", position: 0 },
                  { color: "#0000ff", position: 1 },
                ],
              },
            },
            box: {
              type: "frame",
              name: "Box",
              layout: { direction: "column" },
              children: [],
              styles: { position: "absolute", top: "10px", left: "20px" },
            },
          },
        },
      },
    };
    const result = CanvasDocumentSchema.parse(data);
    const root = result.pages.page1.nodes.root;
    expect(root.stroke).toBeDefined();
    expect(root.effects).toHaveLength(1);
    expect(root.gradient).toBeDefined();
    expect((root as any).clip).toBe(true);
  });
});
